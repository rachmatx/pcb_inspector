# ML PIPELINE — PCB Inspector

## 1. Objective

Train an object-detection model that identifies and localizes common PCB defects.

## 2. Pipeline

```text
Dataset
  |
  v
Audit
  |
  v
Clean
  |
  v
Split
  |
  v
Preprocess
  |
  v
Baseline training
  |
  v
Validation
  |
  v
Experiment
  |
  v
Test
  |
  v
Error analysis
  |
  v
Final model
  |
  v
Export
  |
  v
Inference API
```

## 3. Model strategy

Use transfer learning.

Start from a pretrained small YOLO model rather than training from random initialization.

The exact model/version must be recorded in `EXPERIMENTS.md`.

## 4. Baseline

The baseline should change as few variables as possible.

Record:
- model
- pretrained checkpoint
- image size
- batch size
- epochs
- optimizer
- learning rate
- augmentation settings
- hardware
- software versions
- dataset version

## 5. Initial baseline hypothesis

A pretrained small YOLO detector should provide a useful starting point, but small PCB defects may remain difficult to detect at standard input resolution.

This creates the basis for later experiments.

## 6. Experiment plan

### E0 — Dataset-only baseline
Goal:
Establish dataset statistics and verify the training pipeline.

### E1 — YOLO baseline
Goal:
Measure normal performance without research-specific modifications.

### E2 — Augmentation
Goal:
Test robustness to realistic image variation.

### E3 — Higher resolution
Goal:
Determine whether larger input images improve small-defect detection.

### E4 — Tiling
Goal:
Test whether dividing large images into overlapping tiles improves detection of tiny defects.

### E5 — Final comparison
Goal:
Compare E1-E4 under the same test set.

Only perform an experiment if it answers a research question.

## 7. Metrics

Primary:
- mAP@50
- mAP@50:95

Secondary:
- precision
- recall
- F1-score
- per-class AP
- inference time
- model size

For small-object research, per-class and size-related error analysis is important.

## 8. Error analysis

Inspect:
- false positives
- false negatives
- missed tiny defects
- confused classes
- multiple detections for one defect
- poor localization
- low-confidence correct detections

Create an error gallery for the thesis/journal.

## 9. Model selection

Do not select the model using training performance.

Selection must be based on validation performance.

The final untouched test set is used once the experiment design is frozen.

## 10. Final model

After selecting the best configuration:
- retrain if justified
- evaluate on the fixed test set
- save model weights
- save configuration
- save metrics
- record exact software versions

## 11. Export

Possible deployment formats:
- PyTorch/Ultralytics `.pt`
- ONNX if useful for the backend

Do not optimize/export prematurely.

First prove that the original model works.

## 12. Inference

The inference service should:
1. receive image
2. validate image
3. load model once at startup
4. run inference
5. convert results to API schema
6. return detections

The model should not be reloaded for every request.

## 13. Reproducibility

Every model artifact should be associated with:
- experiment ID
- dataset version
- source commit
- model version
- training configuration
- evaluation result

## 14. Implementation status (2026-09-03)

What exists in the repository today, mapped to the pipeline above:

- **Audit** — `ml/scripts/audit_dataset.py` (read-only Pascal VOC audit); results in `ml/scripts/audit_report.json` (693 images, 2,953 objects, no malformed entries).
- **Split** — `ml/scripts/split_dataset.py`: leakage-safe split by PCB group (seed 42). Split files live in `splits/` (`train.txt`, `val.txt`, `test.txt`, `split_summary.json`).
- **Convert** — `ml/scripts/convert_to_yolo.py`: Pascal VOC → YOLO txt (normalized `class x_center y_center w h`), outputs `ml/data/processed/yolo_dataset/` with `data.yaml` (processed data is NOT committed).
- **Training** — run on Kaggle (NVIDIA T4) from notebooks in `ml/notebooks/`; results recorded in `docs/EXPERIMENTS.md`.
- **Production model** — E05 (YOLOv8s @ 1280px, mAP50 0.956, P 0.976, R 0.883); curated training evidence (E01–E05 curves, confusion matrices, metrics JSON) under `artifacts/PCB_Inspector_Results_E01_to_E05/` — committed. Raw per-run folders (`artifacts/E03_higher_res/`, `artifacts/E05_yolov8s_1280/`) and `*.pt` weights stay local / on Hugging Face, not in git.
- **Calibration** — threshold sweep E16 (120 val images, ensemble 1280+1600): micro-F1 max @ 0.45; presets 0.30/0.45/0.60 (`web/src/lib/sensitivity.ts`). Override path via `VAL_RAW_JSON` (`backend/sweep_*.py`).
- **Inference API** — `backend/main.py` auto-discovers every `*.pt` in `backend/models/` and preloads the default (`PCB_MODEL`, default `best-e03v2-yolov8s`) once at startup; ensemble 1280+1600 with NMS-fusion (IoU 0.50), per-class confidence thresholds, max 20 detections, 15 MB upload cap, non-PCB soft gate. Backend tests: `backend/tests/` (12 passed).
- **Export** — weights are kept as Ultralytics `.pt`; no ONNX/TorchScript export has been done yet.
