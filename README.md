# PCB Inspector

**PCB Inspector** is a computer-vision system for detecting and localizing printed circuit board (PCB) surface defects from uploaded or camera-captured images. It uses a YOLO-based object detector exposed through a shared REST API used by a web client (and, in the future, a mobile client).

## Research focus

> Improving small-defect detection on PCB images using object detection and image-resolution strategies.

## Current status

- **Dataset**: [PCB Defect Dataset](https://www.kaggle.com/datasets/akhatova/pcb-defects) (Kaggle, Pascal VOC format) — 693 images, 2,953 bounding-box objects, 10 PCB groups, 6 defect classes: `missing_hole`, `mouse_bite`, `open_circuit`, `short`, `spur`, `spurious_copper`.
- **Audit & prep**: dataset audit report at `ml/scripts/audit_report.json`; pipeline scripts in `ml/scripts/` (`audit_dataset.py`, `convert_to_yolo.py`, `split_dataset.py`); leakage-safe splits (by PCB group) in `splits/`.
- **Training**: Ultralytics YOLO experiments run on Kaggle (NVIDIA T4) and recorded in `ml/notebooks/` and `docs/EXPERIMENTS.md`.
- **Production model**: E05 — YOLOv8s @ 1280px (mAP50 0.956, precision 0.976, recall 0.883, F1 0.927), ensemble 1280+1600, threshold sweep E16 (F1-max micro @ 0.45). Full evidence: `docs/EXPERIMENTS.md` + in-app Model Card at `/model`.
- **Backend**: FastAPI app (`backend/main.py`) exposing inference; auto-discovers every `*.pt` in `backend/models/` (default `best-e03v2-yolov8s`, override `PCB_MODEL`). Test suite: `backend/tests/` (pytest).
- **Web**: Next.js client (`web/`) — multi-image upload, sensitivity presets, two-model compare, ZoomableViewer, history + email/password auth (SQLite locally, Turso in production), offline demo mode (`?demo=1`), PDF report, Model Card page.

## Repository layout

```
pcb-inspector/
├── backend/            # FastAPI app (main.py) + models/*.pt + tests/ + Dockerfile/app.py (HF Spaces)
├── web/                # Next.js web client (deploy terpisah ke Vercel, root dir = web/)
├── ml/                 # Dataset audit/prep scripts, notebooks, data (raw/processed tidak di-commit)
├── artifacts/          # Bukti training kurasi E01–E05 (PCB_Inspector_Results_E01_to_E05/); run mentah & *.pt tidak di-commit
├── splits/             # Leakage-safe train/val/test split files
├── docs/               # Project documentation (see map below)
├── requirements.txt    # Python dependencies (lokal)
└── README.md
```

## Running locally

### 1. Backend (FastAPI)

Requires Python with the dependencies in `requirements.txt` and model weights in `backend/models/` (every `*.pt` becomes selectable; `*.pt` files are NOT committed — see Deployment):

```bash
pip install -r requirements.txt
cd backend
uvicorn main:app --reload
```

The API is then available at `http://localhost:8000` (interactive docs at `/docs`).

Konfigurasi backend bisa dioverride lewat environment variables (opsional):

- `PCB_MODEL` — ID model default (nama file tanpa `.pt`, default `best-e03v2-yolov8s`)
- `PCB_MODELS_DIR` — folder model relatif terhadap `backend/` (default `models`)
- `PCB_CONF` — confidence threshold dasar model (default `0.25`)
- `PCB_IMGSZ` — resolusi inference utama (default `1280`)
- `PCB_ENSEMBLE_IMGSZ` — resolusi kedua untuk ensemble multi-resolusi (default `1600`; set kosong untuk menonaktifkan)
- `PCB_ENSEMBLE_IOU` — ambang IoU penggabungan deteksi ensemble (default `0.50`)
- `PCB_IOU`, `PCB_MAX_DET` — parameter NMS & batas deteksi (default `0.50`, `20`)
- `PCB_MAX_IMAGE_MB` — batas upload (default `15`, selaras validasi frontend)
- `PCB_MIN_SCORE` — gate gambar-non-PCB (default `0.40`)

Endpoints:

- `GET /health` — health check returning the served model version.
- `GET /models` — daftar model tersedia + default.
- `POST /predict` — multipart upload (field `file`) of a JPG/PNG/BMP image (+ `conf`, `model_id`); returns detected classes, bounding boxes, and confidence scores.

### 2. Web client (Next.js)

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000`. Environment (salin ke `web/.env.local` — file ini tidak di-commit):

- `NEXT_PUBLIC_API_URL` — URL backend (default `http://localhost:8000`)
- `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` — database produksi (tanpa ini dipakai file SQLite lokal `./sqlite.db`)
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` — auth

Fitur utama: `/inspect` (upload multi-gambar, preset sensitivitas 0.30/0.45/0.60, banding 2 model, viewer zoom + tabel sinkron, ekspor JSON/CSV/PDF), `/history` (riwayat + review), `/model` (Model Card: metrik, kalibrasi E16, keterbatasan), mode demo offline `?demo=1` untuk presentasi tanpa backend.

## Deployment

- **Frontend → Vercel**: import repo, Root Directory = `web/`, set env di atas.
- **Backend → Modal** (serverless, allowance gratis): `modal volume put` bobot ke Volume `pcb-models`, lalu `modal deploy backend/modal_app.py` (lihat header file itu). Kontrak API tak berubah; yang dipakai frontend hanya URL hasil deploy.
- **Database → Turso** (libSQL, dialek tetap SQLite): buat DB → `drizzle-kit push` dengan env Turso (lihat `web/drizzle.config.ts`).

> Catatan: `backend/Dockerfile` + `app.py` + `README.hf.md` adalah sisa percobaan Hugging Face Spaces (ZeroGPU menolak server persisten tanpa fungsi `@spaces.GPU`) — tidak dipakai.

## Documentation map

- `docs/PRD.md` — product requirements
- `docs/DESIGN.md` — UI/UX and interaction design
- `docs/ARCHITECTURE.md` — system architecture
- `docs/DATASET.md` — dataset acquisition, audit, split and provenance
- `docs/ML_PIPELINE.md` — preprocessing, training, evaluation and model lifecycle
- `docs/EXPERIMENTS.md` — experiment registry and result recording
- `docs/RESEARCH.md` — thesis/journal research plan
- `docs/DEVELOPMENT.md` — development workflow and coding rules
- `docs/DECISIONS.md` — architectural and research decisions
- `docs/ROADMAP.md` — staged implementation plan and progress status

## Non-goals

The MVP does not include: chatbot, generative AI, OCR, user social features, marketplace, real-time video inspection, or multiple unrelated computer-vision models. (Email/password auth + per-user history exist, but SSO/roles do not.)

## Golden rule

Do not build the software before the dataset and baseline model are understood.

Research first. Dataset second. Baseline third. Product fourth.
