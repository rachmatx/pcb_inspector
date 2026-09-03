"""Test suite backend PCB Inspector (jalan: ../venv/Scripts/python -m pytest).

Mencakup kontrak API /health, /models, /predict (validasi, batas ukuran,
gate non-PCB) + fungsi murni (_iou, _nms_fusion, _pcb_score).
Import `main` memuat model default sekali (~20 dtk CPU) — wajar untuk suite.
"""

import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

import main

client = TestClient(app=main.app, raise_server_exceptions=False)


def _img_bytes(color: tuple[int, int, int], size=(160, 160)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="JPEG")
    return buf.getvalue()


def _post_image(data: bytes, ctype="image/jpeg", **form):
    files = {"file": ("uji.jpg", data, ctype)}
    return client.post("/predict", files=files, data=form)


# ---------- /health & /models ----------

def test_health_ok_dan_default_e03v2():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model"] == "best-e03v2-yolov8s"
    assert "best-e03v2-yolov8s" in body["models"]


def test_models_memuat_default():
    r = client.get("/models")
    assert r.status_code == 200
    body = r.json()
    assert body["default"] == "best-e03v2-yolov8s"
    ids = [m["id"] for m in body["models"]]
    assert body["default"] in ids


# ---------- validasi /predict ----------

def test_predict_tolak_format():
    r = client.post(
        "/predict",
        files={"file": ("x.txt", b"halo", "text/plain")},
    )
    assert r.status_code == 400


def test_predict_tolak_conf_di_luar_rentang():
    r = _post_image(_img_bytes((0, 128, 0)), conf="1.5")
    assert r.status_code == 400


def test_predict_tolak_model_tak_dikenal():
    r = _post_image(_img_bytes((0, 128, 0)), model_id="tidak-ada")
    assert r.status_code == 400


def test_predict_tolak_gambar_rusak():
    r = _post_image(b"bukan-gambar", ctype="image/jpeg")
    assert r.status_code == 400


def test_predict_tolak_kelebihan_ukuran(monkeypatch):
    monkeypatch.setattr(main, "MAX_IMAGE_BYTES", 1024)
    r = _post_image(_img_bytes((0, 128, 0), size=(400, 400)))
    assert r.status_code == 413
    assert "melebihi" in r.json()["detail"]


# ---------- perilaku /predict ----------

def test_predict_hijau_valid_skor_tinggi():
    r = _post_image(_img_bytes((10, 120, 40), size=(320, 320)))
    assert r.status_code == 200
    body = r.json()
    assert set(body) >= {
        "model_id", "model_display", "inference_ms",
        "detections", "pcb_score",
    }
    assert body["pcb_score"] >= main.PCB_MIN_SCORE
    assert isinstance(body["detections"], list)


def test_predict_putih_flag_non_pcb():
    r = _post_image(_img_bytes((250, 250, 250), size=(320, 320)))
    assert r.status_code == 200
    assert r.json()["pcb_score"] < main.PCB_MIN_SCORE


# ---------- fungsi murni ----------

def test_iou():
    assert main._iou([0, 0, 10, 10], [0, 0, 10, 10]) == pytest.approx(1.0)
    assert main._iou([0, 0, 10, 10], [20, 20, 30, 30]) == 0.0
    # tumpang setengah: inter 25, union 175
    assert main._iou([0, 0, 10, 10], [5, 5, 15, 15]) == pytest.approx(25 / 175)


def test_nms_fusion_simpan_conf_tertinggi():
    boxes = [
        {"class_id": 0, "confidence": 0.5, "bbox": [0, 0, 10, 10]},
        {"class_id": 0, "confidence": 0.9, "bbox": [1, 1, 11, 11]},
        {"class_id": 1, "confidence": 0.8, "bbox": [1, 1, 11, 11]},
    ]
    out = main._nms_fusion(boxes, 0.50)
    assert len(out) == 2
    kept0 = [b for b in out if b["class_id"] == 0][0]
    assert kept0["confidence"] == pytest.approx(0.9)


def test_pcb_score_hijau_vs_putih():
    green = np.full((64, 64, 3), [10, 120, 40], dtype=np.uint8)
    white = np.full((64, 64, 3), [250, 250, 250], dtype=np.uint8)
    assert main._pcb_score(green) >= main.PCB_MIN_SCORE
    assert main._pcb_score(white) < main.PCB_MIN_SCORE
