"""Dump prediksi mentah E05 pada val set (2 resolusi, conf floor 0.10).

Mencerminkan jalur produksi backend/main.py (_predict_boxes):
imgsz 1280 + 1600, iou=0.50, max_det=20. Thresholding + NMS-fusion
dilakukan offline oleh sweep_thresholds.py agar sweep murah.
"""

import json
import os
import time
from pathlib import Path

from ultralytics import YOLO

VAL_IMG = Path("../ml/data/processed/yolo_dataset/val/images")
# Bisa dioverride: VAL_RAW_JSON=/path/ke/val_raw.json
OUT = Path(os.environ.get("VAL_RAW_JSON", "../artifacts/val_raw.json"))
FLOOR = 0.10

model = YOLO("models/best-e05v1-yolov8s.pt")

imgs = sorted(VAL_IMG.glob("*.jpg"))
print(f"{len(imgs)} gambar val")

t0 = time.time()
rows = []
for i, p in enumerate(imgs):
    entry = {"img": p.name, "res": {}}
    for imsz in (1280, 1600):
        r = model.predict(
            str(p), imgsz=imsz, conf=FLOOR, iou=0.50, max_det=20, verbose=False
        )[0]
        boxes = []
        if r.boxes is not None:
            for b in r.boxes:
                x1, y1, x2, y2 = b.xyxy[0].tolist()
                boxes.append(
                    {
                        "cls": int(b.cls[0]),
                        "conf": float(b.conf[0]),
                        "bbox": [x1, y1, x2, y2],
                    }
                )
        entry["res"][str(imsz)] = boxes
    rows.append(entry)
    if (i + 1) % 10 == 0:
        dt = time.time() - t0
        print(f"{i+1}/{len(imgs)}  {dt:.0f}s  (~{dt/(i+1):.1f}s/gambar)")

OUT.write_text(json.dumps(rows))
print(f"OK -> {OUT}  total {time.time()-t0:.0f}s")
