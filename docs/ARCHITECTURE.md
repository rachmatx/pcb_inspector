# ARCHITECTURE — PCB Inspector

## 1. System Overview
PCB Inspector adalah sistem deteksi cacat PCB (Printed Circuit Board) end-to-end yang menggunakan arsitektur Client-Server. Web dan Mobile client berbagi satu backend API yang sama untuk melakukan inference model YOLOv8.

## 2. Architecture Diagram

┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐              ┌──────────────┐            │
│  │  Web Client  │              │ Mobile Client│            │
│  │  (Next.js)   │              │  (Expo/RN)   │            │
│  └──────┬───────┘              └──────┬───────┘            │
│         │                              │                   │
└─────────┼──────────────────────────────┼───────────────────┘
          │                              │
          │         HTTP/REST            │
          │                              │
┌─────────┼──────────────────────────────┼───────────────────
│         │         API LAYER            │                   │
├─────────┼──────────────────────────────┼───────────────────
│         ▼                              ▼                   │
│  ┌─────────────────────────────────────────┐              │
│  │         FastAPI Backend                 │              │
│  │  ┌──────────────────────────────────┐  │              │
│  │  │  POST /predict                   │  │              │
│  │  │  - Image validation              │  │              │
│  │  │  - Preprocessing (Resize 1280px) │  │              │
│  │  │  - YOLOv8s inference             │  │              │
│  │  │  - Postprocessing (NMS)          │  │              │
│  │  │  - Response formatting           │  │              │
│  │  └──────────────────────────────────┘  │              │
│  └─────────────────────────────────────────┘              │
│                           │                               │
└───────────────────────────┼───────────────────────────────┘
                            │
                            │ Load model
                            │
┌───────────────────────────┼───────────────────────────────┐
│                           │     ML LAYER                  │
├───────────────────────────┼───────────────────────────────┤
│                           ▼                               │
│  ┌─────────────────────────────────────────┐              │
│  │      YOLOv8s Model (Final: E03)         │              │
│  │  - Input: 1280x1280 RGB image           │              │
│  │  - Output: Bounding boxes + classes     │              │
│  │  - Classes: 6 defect types              │              │
│  │  - Inference: ~45ms per image (T4 GPU)  │              │
│  │  - Parameters: 11.2M                    │              │
│  └─────────────────────────────────────────              │
└───────────────────────────────────────────────────────────┘

3. Component Details
3.1 ML Pipeline
Location: ml/
Framework: Ultralytics YOLOv8 (PyTorch).
Training Environment: Cloud GPU (Kaggle Notebook, NVIDIA T4).
Inference Environment: CPU/GPU (FastAPI backend).
Model Specifications:
Architecture: YOLOv8s (Small).
Input Size: 1280x1280 pixels.
Classes: 6 (missing_hole, mouse_bite, open_circuit, short, spur, spurious_copper).
Final Model: E03 (mAP50: 0.957, mAP50-95: 0.529).

3.2 Backend API
Location: backend/
Framework: FastAPI (Python).
Endpoints:
POST /predict: Menerima gambar (multipart/form-data), mengembalikan JSON berisi bounding box, kelas, dan confidence.
GET /health: Health check endpoint.
GET /info: Informasi model dan versi API.
Constraints: Max upload size 10MB, hanya menerima format JPG/PNG.

3.3 Web Client
Location: web/
Framework: Next.js (React), TypeScript, Tailwind CSS.
Features: Drag & drop upload, visualisasi bounding box, daftar defect, dan confidence score.

3.4 Mobile Client
Location: mobile/
Framework: Expo (React Native), TypeScript.
Features: Camera capture, upload from gallery, visualisasi hasil deteksi.

4. Data Flow (Inference)
User mengunggah/mengambil gambar PCB dari Web/Mobile.
Client memvalidasi format dan ukuran gambar.
Client mengirim gambar via POST /predict ke FastAPI.
FastAPI memvalidasi gambar, me-resize ke 1280x1280, dan menjalankan YOLOv8s.
YOLOv8s menghasilkan bounding box dan class probabilities.
FastAPI melakukan Non-Maximum Suppression (NMS) dan memformat response JSON.
Client menerima JSON dan merender bounding box di atas gambar asli.

5. Code Organization
pcb-inspector/
├── ml/                    # ML training dan inference scripts
│   ├── training/          # Notebook dan script training YOLO
│   ├── models/            # Model weights (best.pt)
│   └── utils/             # Utility functions (dataset, metrics)
│
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── main.py        # FastAPI app entry point
│   │   ├── routes/        # API routes (/predict, /health)
│   │   └── services/      # Inference logic
│   ├── requirements.txt
│   └── Dockerfile
│
── web/                   # Next.js web client
│   ├── app/               # Next.js app router
│   ├── components/        # React components
│   ── package.json
│
├── mobile/                # React Native mobile client
│   ├── app/               # Expo app
│   └── package.json
│
└── docs/                  # Project documentation
    ├── ARCHITECTURE.md
    ├── DATASET.md
    ├── DECISIONS.md
    ├── DESIGN.md
    ├── DEVELOPMENT.md
    ├── EXPERIMENTS.md
    └── ML_PIPELINE.md

6. Security & Constraints
API Security: Validasi MIME type, enforce upload size limit, reject unsupported formats.
Model Security: Model weights tidak diekspos secara publik, input validation sebelum inference.
Data Privacy: Gambar yang diunggah tidak disimpan permanen di server (dihapus setelah inference selesai).