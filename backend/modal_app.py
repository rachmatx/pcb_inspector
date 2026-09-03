# Deploy backend FastAPI ke Modal (serverless; ada allowance gratis bulanan).
#
# 1. venv\Scripts\python.exe -m pip install modal
# 2. venv\Scripts\modal.exe setup            (login via browser, sekali saja)
# 3. Upload bobot (sekali saja / saat ganti model):
#      venv\Scripts\modal.exe volume put pcb-models backend\models\best-e03v2-yolov8s.pt /models/best-e03v2-yolov8s.pt
#      venv\Scripts\modal.exe volume put pcb-models backend\models\best-e05v1-yolov8s.pt /models/best-e05v1-yolov8s.pt
#      venv\Scripts\modal.exe volume put pcb-models backend\models\best-e03v1-yolov8n.pt /models/best-e03v1-yolov8n.pt
# 4. Tes ephemeral:  venv\Scripts\modal.exe serve backend\modal_app.py
# 5. Deploy permanen: venv\Scripts\modal.exe deploy backend\modal_app.py
#
# Bobot .pt tinggal di Volume (bukan di image) agar rebuild image cepat dan
# ganti model tak perlu rebuild. Kontrak API (/health, /models, /predict)
# tidak berubah — yang dipakai frontend hanya URL-nya.
import os
import sys
from pathlib import Path

import modal

APP_NAME = "pcb-inspector"
VOLUME_NAME = "pcb-models"
REMOTE_MODELS = "/vol/models"
LOCAL_BACKEND = Path(__file__).resolve().parent

app = modal.App(APP_NAME)

image = (
    modal.Image.debian_slim(python_version="3.11")
    # OpenCV (via ultralytics) butuh lib sistem ini.
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "ultralytics==8.4.138",
        "fastapi==0.141.1",
        "uvicorn[standard]",
        "pillow>=10,<11",
        "numpy>=1.26,<2.3",
        "python-multipart",
    )
    # Kode backend ikut image (bobor .pt tetap di Volume). copy=False =
    # di-mount saat container start, deploy tetap cepat.
    .add_local_dir(
        LOCAL_BACKEND,
        remote_path="/root/backend",
        ignore=[
            "models",
            "tests",
            "__pycache__",
            ".pytest_cache",
            "hf-space",
            "venv",
            ".venv",
            ".env",
        ],
    )
)

models_vol = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)


@app.function(
    image=image,
    volumes={"/vol": models_vol},
    cpu=2.0,
    memory=4096,
    timeout=600,
    # Tetap hangat 10 menit setelah request — demo live tanpa cold start berulang.
    scaledown_window=600,
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def fastapi_app():
    os.environ.setdefault("PCB_MODELS_DIR", REMOTE_MODELS)
    sys.path.insert(0, "/root/backend")
    from main import app as web_app

    return web_app
