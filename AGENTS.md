# AGENTS — PCB Inspector

Memory untuk agent AI yang bekerja di repositori ini. Dibaca otomatis setiap turn oleh Command Code. Jaga tetap ringkas: detail panjang ada di `docs/` dan hanya dimuat lewat `@`-import saat relevan.

## Project overview

PCB Inspector adalah sistem deteksi cacat PCB berbasis computer vision: pengguna mengunggah gambar PCB, backend FastAPI menjalankan model YOLO (Ultralytics), dan web client menampilkan bounding box hasil deteksi. Detail lengkap: @README.md

## Repository map

- `backend/main.py` — seluruh backend FastAPI (single file): `/health`, `/models`, `/predict`. Auto-discovery setiap `*.pt` di `backend/models/`; default `PCB_MODEL=best-e03v2-yolov8s`; env lain: `PCB_IMGSZ`, `PCB_ENSEMBLE_IMGSZ`, `PCB_CONF`, `PCB_IOU`, `PCB_MAX_DET`, `PCB_MAX_IMAGE_MB`, `PCB_MIN_SCORE`. `Dockerfile`+`app.py`+`requirements.txt` untuk HF Spaces; `sweep_*.py` pakai env `VAL_RAW_JSON`.
- `web/` — client Next.js (App Router, `src/app/`). Halaman: `/` (home) dan `/inspect` (upload + hasil). API call via `web/src/lib/api.ts`. Backend diasumsikan di `http://localhost:8000` (bisa dioverride `NEXT_PUBLIC_API_URL`).
- `ml/` — dataset & eksperimen ML: `scripts/` (audit, split, convert), `notebooks/`, `data/` (raw + processed YOLO).
- `artifacts/` — output training (model produksi saat ini: E05; bukti kurasi E01–E05 di `artifacts/PCB_Inspector_Results_E01_to_E05/` — folder run mentah & `*.pt` tidak di-commit). `splits/` — file split train/val/test. `docs/` — dokumentasi.
- `venv/` — Python virtual environment (jangan dibaca/dimasukkan konteks).

## Run commands

Backend (dari `backend/`, tanpa aktivasi venv — cukup pakai interpreter venv langsung):

```bash
../venv/Scripts/python.exe -m uvicorn main:app --reload
```

Web (dari `web/`):

```bash
npm run dev
```

## Agent rules

Ikuti aturan di @docs/DEVELOPMENT.md — terutama:

- Baca `docs/DECISIONS.md` sebelum perubahan arsitektural; baca bagian relevan `docs/ARCHITECTURE.md` sebelum menyentuh modul terkait.
- Jangan scan seluruh repo tanpa alasan; jangan baca `node_modules/`, `.next/`, `venv/`, dataset mentah, atau model weights.
- Perubahan kecil, test setelah berubah, laporkan persis apa yang berubah.
- Jangan tambah dependensi tanpa justifikasi; jangan ganti stack tanpa decision record.

## Model & dataset facts (standing)

- 6 kelas cacat (urutan = class_id): `missing_hole`, `mouse_bite`, `open_circuit`, `short`, `spur`, `spurious_copper`.
- Dataset: 693 gambar, 2.953 objek, 10 grup PCB (detail di @docs/DATASET.md).
- Eksperimen & hasil: @docs/EXPERIMENTS.md. **Model produksi saat ini: E05** (YOLOv8s @ 1280). Catatan: `docs/EXPERIMENTS.md` & `docs/DECISIONS.md` masih menyebut E03 sebagai final (keputusan lama) — implementasi nyata (default `backend/models/best-e03v2-yolov8s`, artifact E05) adalah E05.
- Dokumentasi target/aspirasi (PRD/DESIGN/RESEARCH) berbeda dari status implementasi — lihat bagian "Progress status" di @docs/ROADMAP.md.

## Docs index (baca hanya yang relevan)

- @docs/ARCHITECTURE.md — arsitektur sistem
- @docs/DATASET.md — dataset, audit, split
- @docs/ML_PIPELINE.md — pipeline ML & status
- @docs/EXPERIMENTS.md — registry eksperimen & hasil
- @docs/DECISIONS.md — keputusan arsitektur/riset
- @docs/PRD.md, @docs/DESIGN.md, @docs/RESEARCH.md — dokumen target produk/riset
- @docs/DEVELOPMENT.md — aturan & workflow development
- @docs/ROADMAP.md — fase & progress status

## Catatan

- `web/AGENTS.md` & `web/CLAUDE.md` adalah auto-generated oleh `next dev` (aturan Next.js), bukan memory proyek — jangan diubah/diandalkan.
- Root bukan git repo; `web/` adalah repo git terpisah (create-next-app). Jangan `git init` di root tanpa instruksi.
