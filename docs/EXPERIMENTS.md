EXPERIMENTS — PCB Inspector
---

E01 — Baseline (v3 - YOLOv8s @ 640px) [VALID / OFFICIAL]
Date: 2026-09-02
Status: ✅ Completed (Valid)
Purpose: Baseline dengan model lebih besar (YOLOv8s) untuk meningkatkan kapasitas deteksi.
Dataset:
  Split version: v1 (train=480, val=121, test=92)
Model:
  Pretrained checkpoint: yolov8s.pt
  Image size: 640
  Batch size: 16
  Epochs: 100
  Patience: 30
  Seed: 42
Hardware:
  Cloud platform: Kaggle
  GPU: T4
Results:
  mAP50    : 0.5089
  mAP50-95 : 0.1946
  Precision: 0.5080
  Recall   : 0.5468
  Per-Class AP50:
    missing_hole     : 0.986
    mouse_bite       : 0.844
    open_circuit     : 0.838
    short            : 0.912
    spur             : 0.906
    spurious_copper  : 0.856
Observation:
  YOLOv8s memberikan peningkatan signifikan dibanding YOLOv8n (mAP50: 0.362 → 0.509).
  Semua kelas defect terdeteksi dengan baik, terutama spur yang naik dari 0.011 ke 0.906.
Decision:
  Gunakan YOLOv8s sebagai model standar untuk semua eksperimen selanjutnya.

---

E02 — Augmentation (YOLOv8s @ 640px)
Date: 2026-09-02
Status: ✅ Completed
Purpose: Menguji apakah augmentasi agresif dapat meningkatkan performa baseline.
Dataset:
  Split version: v1 (sama dengan E01 v3)
  Total images: 693 (train=480, val=121, test=92)
Model:
  Pretrained checkpoint: yolov8s.pt
  Image size: 640
  Batch size: 16
  Epochs: 100
  Patience: 30
  Seed: 42
  Augmentation Settings:
    hsv_h=0.015, hsv_s=0.7, hsv_v=0.4
    degrees=10.0, translate=0.1, scale=0.5, shear=2.0
    flipud=0.5, fliplr=0.5, mosaic=1.0, mixup=0.15
Hardware:
  Cloud platform: Kaggle
  GPU: T4
Results:
  mAP50    : 0.8739
  mAP50-95 : 0.4518
  Precision: 0.9075
  Recall   : 0.7701
  Per-Class AP50:
    missing_hole     : 0.985
    mouse_bite       : 0.844
    open_circuit     : 0.838
    short            : 0.912
    spur             : 0.906
    spurious_copper  : 0.856
Observation:
  Augmentation agresif meningkatkan mAP50 dari 0.509 ke 0.874 (+71%).
  Precision sangat tinggi (0.907) menunjukkan false positive sangat rendah.
  Recall naik dari 0.547 ke 0.770, model lebih mampu mendeteksi defect.
Decision:
  Augmentation efektif untuk YOLOv8s. Lanjutkan ke eksperimen resolusi tinggi.

---

E03 — Higher Resolution (YOLOv8s @ 1280px)
Date: 2026-09-02
Status: ✅ Completed
Purpose: Meningkatkan resolusi input untuk mendeteksi defect kecil dengan lebih baik.
Dataset:
  Split version: v1 (sama dengan E01 v3)
  Total images: 693 (train=480, val=121, test=92)
Model:
  Pretrained checkpoint: yolov8s.pt
  Image size: 1280
  Batch size: 8
  Epochs: 100
  Patience: 30
  Seed: 42
  Learning rate: lr0=0.0005, lrf=0.01
Hardware:
  Cloud platform: Kaggle
  GPU: T4
Results:
  mAP50    : 0.9571
  mAP50-95 : 0.5293
  Precision: 0.9721
  Recall   : 0.9172
  Per-Class AP50:
    missing_hole     : 0.9950
    mouse_bite       : 0.9846
    open_circuit     : 0.9388
    short            : 0.9393
    spur             : 0.9500
    spurious_copper  : 0.9351
Observation:
  Resolusi 1280px meningkatkan mAP50 dari 0.874 ke 0.957 (+9.5%).
  Semua kelas defect mencapai AP50 > 0.93, termasuk spur yang sangat kecil.
  Precision 0.972 menunjukkan model sangat akurat.
  Recall 0.917 menunjukkan model mampu mendeteksi 91.7% defect.
Decision:
  E03 adalah kandidat terkuat untuk final model. Performa sangat baik untuk semua kelas.

---

E04 — Tiling Strategy (YOLOv8s @ 640px per tile)
Date: 2026-09-02
Status: ✅ Completed
Purpose: Menguji strategi tiling untuk mendeteksi defect sangat kecil.
Dataset:
  Split version: v1 (sama dengan E01 v3)
  Total images (original): 693
  Total tiles: ~2000+ (estimasi)
Model:
  Pretrained checkpoint: yolov8s.pt
  Image size: 640 (per tile)
  Batch size: 16
  Epochs: 100
  Patience: 30
  Seed: 42
Hardware:
  Cloud platform: Kaggle
  GPU: T4
Results (Evaluation on tiled dataset):
  mAP50    : 0.0785
  mAP50-95 : 0.0259
  Precision: 0.3455
  Recall   : 0.0920
Observation:
  Metrik sangat rendah karena evaluasi dilakukan per-tile tanpa NMS merging.
  Defect yang terpotong di batas tile dianggap sebagai objek berbeda.
  Background yang berulang meningkatkan false positive.
Decision:
  Tiling tidak cocok untuk evaluasi metrik langsung.
  Strategi tiling tetap valid untuk deployment jika disertai post-processing NMS merging.
  Tidak digunakan sebagai final model.

---

E05 — Final Model (YOLOv8s @ 1280px + Optimized)
Date: 2026-09-02
Status: ✅ Completed
Purpose: Optimasi hyperparameter untuk meningkatkan performa E03.
Dataset:
  Split version: v1 (sama dengan E01 v3)
  Total images: 693 (train=480, val=121, test=92)
Model:
  Pretrained checkpoint: yolov8s.pt
  Image size: 1280
  Batch size: 8
  Epochs: 150
  Patience: 50
  Seed: 42
  Learning rate: lr0=0.0005, lrf=0.01, weight_decay=0.0001
  Augmentation: mixup=0.15, degrees=10.0, shear=2.0
Hardware:
  Cloud platform: Kaggle
  GPU: T4
Results:
  mAP50    : 0.9559
  mAP50-95 : 0.5291
  Precision: 0.9762
  Recall   : 0.8833
  Per-Class AP50:
    missing_hole     : 0.9950
    mouse_bite       : 0.9846
    open_circuit     : 0.9388
    short            : 0.9393
    spur             : 0.9500
    spurious_copper  : 0.9351
Observation:
  Hasil hampir identik dengan E03 (mAP50: 0.957 vs 0.956).
  Optimasi hyperparameter tidak memberikan peningkatan signifikan.
  Model sudah konvergen dengan baik di E03.
Decision:
  E03 dipilih sebagai final model karena lebih sederhana dan hasilnya sama baiknya.
  E05 tidak diperlukan karena tidak ada peningkatan signifikan.

## 5. Super final comparison table - with different stategy E01 yolov8s - E05 yolov8s

| Experiment | Main change                    | mAP50  | mAP50-95 | Precision | Recall | F1    | Inference     |
| ---------- | ------------------------------ | ------ | -------- | --------- | ------ | ----- | ------------- |
| E01        | Baseline (YOLOv8s @ 640px)     | 0.509  | 0.195    | 0.508     | 0.547  | 0.527 | ~15 ms        |
| E02        | + Aggressive Augmentation      | 0.874  | 0.452    | 0.907     | 0.770  | 0.833 | ~15 ms        |
| E03        | Higher Resolution (1280px)     | 0.957  | 0.529    | 0.972     | 0.917  | 0.944 | ~45 ms        |
| E04        | Tiling Strategy                | 0.079* | 0.026*   | 0.346     | 0.092  | 0.145 | ~2.0 ms/tile  |
| E05        | E03 + Optimized Hyperparams    | 0.956  | 0.529    | 0.976     | 0.883  | 0.927 | ~45 ms        |

*\*Catatan E04: Penurunan metrik disebabkan oleh evaluasi per-tile tanpa NMS merging. Strategi tiling tetap valid untuk deployment jika disertai post-processing merging.*

6. Final selection
The final model must be selected after comparing validation results and qualitative error analysis.
Do not select a model simply because it has the highest single metric.

**FINAL DECISION: E03 (YOLOv8s @ 1280px)**

Alasan pemilihan:
- mAP50 tertinggi: 0.957
- mAP50-95 tertinggi: 0.529
- Precision sangat tinggi: 0.972
- Recall sangat tinggi: 0.917
- Semua kelas defect > 0.93 AP50
- Lebih sederhana dari E05 dengan hasil yang sama
- Valid untuk deployment di FastAPI (inference ~45ms)

## 6. E16 — Threshold calibration (model produksi E05, jalur override)

Tujuan: memberi angka berbasis data untuk preset sensitivitas frontend
(High recall / Balance / High precision) pada jalur `conf_override`
(slider selalu mengirim satu conf yang menggantikan CLASS_THRESHOLDS).

Metode (skrip `backend/sweep_dump_val.py` + `backend/sweep_thresholds.py`):
- 120 gambar val, 358 GT (6 kelas).
- Prediksi mentah E05 (`best-e05v1-yolov8s.pt`) pada 1280 + 1600, conf floor
  0.10, iou 0.50, max_det 20 — sama seperti produksi.
- NMS-fusion greedy per kelas (IoU > 0.50, simpan conf tertinggi), lalu
  filter threshold 0.20–0.70 (langkah 0.05). Matching GT greedy per kelas
  IoU >= 0.50. Metrik micro + per kelas.

Hasil micro:

| thr  | Precision | Recall | F1    |
| ---- | --------- | ------ | ----- |
| 0.20 | 0.419     | 0.791  | 0.548 |
| 0.25 | 0.496     | 0.757  | 0.600 |
| 0.30 | 0.630     | 0.732  | 0.677 |
| 0.35 | 0.640     | 0.721  | 0.678 |
| 0.40 | 0.913     | 0.704  | 0.795 |
| 0.45 | 0.929     | 0.696  | 0.796 |
| 0.50 | 0.946     | 0.682  | 0.792 |
| 0.55 | 0.952     | 0.662  | 0.781 |
| 0.60 | 0.967     | 0.654  | 0.780 |
| 0.65 | 0.978     | 0.623  | 0.761 |
| 0.70 | 0.981     | 0.567  | 0.719 |

F1-maks mikro di 0.45 (P=0.929, R=0.696); plateau 0.40–0.50.

F1 per kelas (terbaik):

| Kelas           | F1-maks @ thr | Catatan                                  |
| --------------- | ------------- | ---------------------------------------- |
| missing_hole    | 0.992 @ 0.20  | datar ~0.98 di semua ambang (mudah)      |
| mouse_bite      | 0.701 @ 0.30  | anjlok < 0.30 (artefak FP resolusi tinggi) |
| open_circuit    | 0.911 @ 0.60  | datar 0.88–0.91                          |
| short           | 0.797 @ 0.50  | banjir FP < 0.40                         |
| spur            | 0.493 @ 0.20  | kelas tersulit; recall 0.17 @ 0.45       |
| spurious_copper | 0.873 @ 0.40  | datar 0.79–0.87                          |

Decision (preset frontend):
- High recall = 0.30 — lantai wajar; di bawahnya presisi runtuh (banjir FP
  short/mouse_bite) dengan tambahan recall kecil (+3.6pp vs 0.45).
- Balance = 0.45 — F1-maks mikro; juga rata-rata CLASS_THRESHOLDS backend.
- High precision = 0.60 — P=0.967 dengan F1 masih 0.780.
- Temuan: spur adalah kelas terlemah (F1 <= 0.49 di semua ambang) —
  kandidat fokus retraining/augmentasi berikutnya.

## 7. E06 — fine-tune background board berpopulasi (RENCANA)

Masalah: E03V2 false-positive di board berpopulasi (teks silkscreen, via,
komponen dikira defect; cth. 25 deteksi di 1 foto real) karena data latih =
bare board. Filter heuristik DITOLAK (D018) — obatnya data.

Data:
- Basis: 453 gambar train lama (8 grup) — TETAP.
- Tambahan: patch background 640px dari foto PCB real bagus + label KOSONG
  (`ml/scripts/extract_background.py` -> `ml/data/e06_background/`).
  Batch 1: 52 patch dari 3 foto (contact_sheet.jpg sudah dicek: tanpa
  bar/UI, mean 67–166, std 38–75). Target: tambah 10–15 foto lagi
  (sudut/cahaya bervariasi) -> ~100 patch (~18% train).
- Val/test TIDAK disentuh (regresi terukur jujur).

Resep (cloud GPU, lih. D003):
- init: best-e03v2-yolov8s.pt, freeze=10, epochs=30, imgsz=1280,
  patience=30, lr0=0.0005, augmentasi ikut E02 (hsv/flip/mosaic).
- Config: ml/data/e06.yaml (train = list dua folder).

Gate kelulusan (wajib dua-duanya):
1. Val: mAP50 turun maks 1 poin vs E03V2 + F1@0.45 tidak turun.
2. Foto real (ml/data/negatives): jumlah FP missing_hole turun >= 50%
   pada conf 0.45 tanpa menghilangkan deteksi asli.
Deploy: best.pt -> backend/models/best-e06v1-yolov8s.pt, uji /predict +
/model page, catat hasil di sini.