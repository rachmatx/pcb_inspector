# PCB Inspector backend — image untuk Hugging Face Spaces (Docker SDK).
# Build context = folder backend/ (berisi main.py + models/*.pt).
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # Model default sama dengan lokal; override via Secrets bila perlu.
    PCB_MODEL=best-e03v2-yolov8s \
    PCB_IMGSZ=1280 \
    PCB_ENSEMBLE_IMGSZ=1600

WORKDIR /app

# Torch CPU dulu agar tak menarik build CUDA (±2.5 GB sia-sia di Space CPU).
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir \
    ultralytics==8.4.138 \
    fastapi==0.141.1 \
    "uvicorn[standard]" \
    pillow==12.3.0 \
    "numpy==2.4.6" \
    python-multipart

COPY main.py ./
COPY models/ ./models/

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
