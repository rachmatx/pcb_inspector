---
title: PCB Inspector API
emoji: 🔍
colorFrom: green
colorTo: gray
sdk: gradio
sdk_version: "5.0.0"
app_file: app.py
pinned: false
---

# PCB Inspector API

Backend deteksi cacat PCB (FastAPI + YOLO, diserve via `app.py` di port 7860).

- `GET /health` — status + model aktif
- `POST /predict` — multipart `file` (+ `conf`, `model_id`) → JSON deteksi
- `GET /models` — daftar model + default
