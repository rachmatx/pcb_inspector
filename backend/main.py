# backend/main.py
import io
import logging
import os
import time
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="PCB Inspector API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Konfigurasi (bisa dioverride lewat environment) ---
# Model di-resolve relatif terhadap folder backend/ agar tidak bergantung CWD.
BACKEND_DIR = Path(__file__).resolve().parent
MODELS_DIR = BACKEND_DIR / os.environ.get("PCB_MODELS_DIR", "models")

# Konfigurasi inference
GLOBAL_CONF = float(os.environ.get("PCB_CONF", "0.25"))
IOU_THRESHOLD = float(os.environ.get("PCB_IOU", "0.50"))
MAX_DET = int(os.environ.get("PCB_MAX_DET", "20"))

# Resolusi inference. Cacat kecil di gambar full-board (~3000px) kehilangan
# detail saat di-resize, sehingga confidence turun. Ensemble multi-resolusi
# (PCB_IMGSZ + PCB_ENSEMBLE_IMGSZ) menggabungkan deteksi dari dua resolusi dan
# mengambil confidence tertinggi per objek — lebih konsisten daripada satu
# resolusi. Set PCB_ENSEMBLE_IMGSZ="" untuk menonaktifkan ensemble.
FULL_IMGSZ = int(os.environ.get("PCB_IMGSZ", "1280"))
ENSEMBLE_IMGSZ_ENV = os.environ.get("PCB_ENSEMBLE_IMGSZ", "1600")
ENSEMBLE_IMGSZ = int(ENSEMBLE_IMGSZ_ENV) if ENSEMBLE_IMGSZ_ENV.strip() else None
ENSEMBLE_IOU = float(os.environ.get("PCB_ENSEMBLE_IOU", "0.50"))

# --- Multi-model ---
# Setiap file *.pt di MODELS_DIR menjadi model yang bisa dipilih.
# ID model = nama file tanpa ekstensi (mis. "best-e05v1-yolov8s").
class ModelEntry:
    __slots__ = ("id", "display", "path", "model")

    def __init__(self, path: Path):
        self.id = path.stem  # nama file tanpa .pt
        # Label tampilan: "best-e05v1-yolov8s" -> "E05V1 · YOLOv8s"
        raw = self.id
        if raw.startswith("best-"):
            raw = raw[len("best-"):]
        parts = raw.split("-")
        label_parts = []
        for p in parts:
            if p.lower().startswith("yolo"):
                # yolov8s -> YOLOv8s
                label_parts.append("YOLO" + p[4:])
            else:
                label_parts.append(p.upper())
        self.display = " · ".join(label_parts)
        self.path = path
        self.model = None

    def load(self):
        if self.model is None:
            self.model = YOLO(self.path)
        return self.model


def discover_models() -> list[ModelEntry]:
    if not MODELS_DIR.is_dir():
        raise RuntimeError(f"Folder model tidak ditemukan: {MODELS_DIR}")
    entries = []
    for p in sorted(MODELS_DIR.glob("*.pt")):
        entries.append(ModelEntry(p))
    if not entries:
        raise RuntimeError(f"Tidak ada file *.pt di {MODELS_DIR}")
    return entries


MODELS: list[ModelEntry] = discover_models()
MODELS_BY_ID: dict[str, ModelEntry] = {m.id: m for m in MODELS}
# Model default: best-e03v2-yolov8s (terbaik hasil latih; bisa dioverride
# PCB_MODEL). Gagal loud saat startup bila ID tidak dikenal.
DEFAULT_MODEL_ID = os.environ.get("PCB_MODEL", "best-e03v2-yolov8s")
if DEFAULT_MODEL_ID not in MODELS_BY_ID:
    raise RuntimeError(f"PCB_MODEL tidak dikenal: {DEFAULT_MODEL_ID}")

# Pra-muat model default saat startup.
MODELS_BY_ID[DEFAULT_MODEL_ID].load()

CLASS_NAMES = [
    "missing_hole",
    "mouse_bite",
    "open_circuit",
    "short",
    "spur",
    "spurious_copper",
]

# Threshold minimum per kelas.
# GLOBAL_CONF dipakai sebagai ambang dasar model; kelas yang rawan false
# positive (mouse_bite, short) dinaikkan sedikit agar deteksi palsu
# ber-confidence rendah tidak muncul.
CLASS_THRESHOLDS = {
    0: 0.40,  # missing_hole
    1: 0.60,  # mouse_bite (0.55-0.60: artefak FP konsisten di resolusi tinggi)
    2: 0.45,  # open_circuit
    3: 0.50,  # short
    4: 0.40,  # spur
    5: 0.45,  # spurious_copper
}

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/bmp"}

# Batas ukuran upload — selaras dengan validasi frontend (MAX_FILE_BYTES
# 15 MB di web). Dicek di sini agar tidak bisa di-bypass via API langsung.
MAX_IMAGE_BYTES = int(float(os.environ.get("PCB_MAX_IMAGE_MB", "15")) * 1024 * 1024)

# Ambang skor kemiripan-PCB. Kalibrasi (Fase 1, lihat D016): fraksi hijau —
# val 120 gambar min 0.894, foto berwarna/struk/dokumen 0.0. Soft gate —
# di bawah ini respons tetap dikembalikan, frontend yang memberi
# peringatan + melewatkan simpan.
PCB_MIN_SCORE = float(os.environ.get("PCB_MIN_SCORE", "0.40"))


def _pcb_score(img: np.ndarray) -> float:
    """Skor 0..1 seberapa mirip gambar dengan foto PCB.

    Heuristik murah (tanpa dependensi baru): fraksi piksel HIJAU jenuh
    (soldermask) pada thumbnail 320px. Dataset 100% hijau sehingga hanya
    hijau yang dihitung — foto berwarna (langit biru, banner oranye)
    mendapat ~0.0. Bukan klasifier sempurna: foto alam berdaun dan PCB
    soldermask hitam/putih bisa salah nilai — dipakai sebagai peringatan,
    bukan penolakan (lihat D016; klasifier biner direncanakan Fase 2).
    """
    thumb = np.asarray(Image.fromarray(img).resize((320, 320))).astype(np.float32) / 255.0
    mx = thumb.max(-1)
    mn = thumb.min(-1)
    s = (mx - mn) / np.maximum(mx, 1e-6)
    r, g, b = thumb[..., 0], thumb[..., 1], thumb[..., 2]
    h = np.zeros_like(mx)
    m = mx - mn
    sel = m > 1e-6
    ir = sel & (mx == r)
    ig = sel & (mx == g)
    ib = sel & (mx == b)
    with np.errstate(invalid="ignore", divide="ignore"):
        h[ir] = ((g[ir] - b[ir]) / m[ir]) % 6 / 6
        h[ig] = ((b[ig] - r[ig]) / m[ig] + 2) / 6
        h[ib] = ((r[ib] - g[ib]) / m[ib] + 4) / 6
    hd = h * 360.0
    green = ((hd > 60) & (hd < 170)) & (s > 0.18)
    return float(green.mean())


def _predict_boxes(model: YOLO, img: np.ndarray, imgsz: int, conf: float) -> list[dict]:
    """Jalankan model pada satu resolusi, kembalikan deteksi mentah."""
    results = model.predict(
        img,
        imgsz=imgsz,
        conf=conf,
        iou=IOU_THRESHOLD,
        max_det=MAX_DET,
        verbose=False,
    )
    boxes = []
    if len(results) > 0 and results[0].boxes is not None:
        for box in results[0].boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            boxes.append({
                "class_id": int(box.cls[0]),
                "confidence": float(box.conf[0]),
                "bbox": [x1, y1, x2, y2],
            })
    return boxes


def _iou(a: list[float], b: list[float]) -> float:
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _nms_fusion(boxes: list[dict], iou_threshold: float) -> list[dict]:
    """Gabungkan deteksi dari beberapa resolusi:
    greedy per kelas — jika IoU > threshold, anggap objek sama dan ambil
    confidence tertinggi. Jika IoU rendah, pertahankan sebagai objek berbeda.
    """
    boxes = sorted(boxes, key=lambda d: d["confidence"], reverse=True)
    fused: list[dict] = []
    for det in boxes:
        dup = False
        for kept in fused:
            if det["class_id"] != kept["class_id"]:
                continue
            if _iou(det["bbox"], kept["bbox"]) > iou_threshold:
                dup = True
                break
        if not dup:
            fused.append(det)
    return fused


def _run_inference(
    entry: ModelEntry,
    img: np.ndarray,
    conf_override: float | None = None,
) -> tuple[list[dict], float]:
    """Jalankan inference (satu resolusi atau ensemble), terapkan threshold
    per kelas, kembalikan (detections, inference_ms).

    conf_override: bila diberikan, dipakai sebagai satu-satunya ambang
    confidence (menggantikan CLASS_THRESHOLDS) — untuk eksplorasi/slider.
    """
    model = entry.load()
    base_conf = conf_override if conf_override is not None else GLOBAL_CONF
    start = time.time()
    if ENSEMBLE_IMGSZ is not None and ENSEMBLE_IMGSZ != FULL_IMGSZ:
        raw = _predict_boxes(model, img, FULL_IMGSZ, base_conf) + _predict_boxes(
            model, img, ENSEMBLE_IMGSZ, base_conf
        )
        raw = _nms_fusion(raw, ENSEMBLE_IOU)
    else:
        raw = _predict_boxes(model, img, FULL_IMGSZ, base_conf)
    inference_ms = (time.time() - start) * 1000

    detections = []
    for det in raw:
        cls = det["class_id"]
        if conf_override is not None:
            if det["confidence"] < conf_override:
                continue
        else:
            if det["confidence"] < CLASS_THRESHOLDS.get(cls, 0.40):
                continue
        x1, y1, x2, y2 = det["bbox"]
        detections.append({
            "class_id": cls,
            "class_name": CLASS_NAMES[cls],
            "confidence": det["confidence"],
            "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        })

    detections = sorted(detections, key=lambda d: d["confidence"], reverse=True)
    return detections, inference_ms


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": DEFAULT_MODEL_ID,
        "models": [m.id for m in MODELS],
    }


@app.get("/models")
def list_models():
    return {
        "default": DEFAULT_MODEL_ID,
        "models": [{"id": m.id, "display": m.display} for m in MODELS],
    }


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    conf: float | None = Form(None),
    model_id: str | None = Form(None),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    if conf is not None and not (0.0 <= conf <= 1.0):
        raise HTTPException(status_code=400, detail="conf must be between 0 and 1")

    # Pilih model: param eksplisit, atau default.
    entry = MODELS_BY_ID.get(model_id or DEFAULT_MODEL_ID)
    if entry is None:
        raise HTTPException(status_code=400, detail=f"Model tidak dikenal: {model_id}")

    try:
        image_bytes = await file.read()
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = np.array(pil_img)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image")

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Ukuran gambar {(len(image_bytes) / 1048576):.1f} MB melebihi "
                f"batas {(MAX_IMAGE_BYTES / 1048576):.0f} MB. "
                "Perkecil/kompres gambar lalu coba lagi."
            ),
        )

    try:
        detections, inference_ms = _run_inference(entry, img, conf_override=conf)
    except Exception:
        logger.exception("Inference gagal")
        raise HTTPException(status_code=500, detail="Inference failed")

    return {
        "model_id": entry.id,
        "model_display": entry.display,
        "model_version": entry.display,  # backward-compat
        "inference_ms": inference_ms,
        "detections": detections,
        "pcb_score": _pcb_score(img),
    }
