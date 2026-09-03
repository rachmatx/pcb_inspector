# DATASET — PCB Inspector

## 1. Overview
Dataset yang digunakan untuk deteksi cacat PCB (Printed Circuit Board) terdiri dari 693 gambar dengan 2953 objek cacat yang terdistribusi dalam 10 grup PCB berbeda (source: https://www.kaggle.com/datasets/akhatova/pcb-defects).

## 2. Dataset Source
- **Nama**: PCB Defect Dataset
- **Format**: Pascal VOC (XML annotations)
- **Total Images**: 693
- **Total Annotations**: 693 (1:1 dengan images)
- **Total Objects**: 2953
- **PCB Groups**: 10 (PCB 01 - 12)

## 3. Classes
Dataset memiliki 6 kelas cacat:

| Class ID | Class Name | Count | Percentage |
|----------|------------|-------|------------|
| 0 | missing_hole | 497 | 16.8% |
| 1 | mouse_bite | 512 | 17.3% |
| 2 | open_circuit | 488 | 16.5% |
| 3 | short | 495 | 16.8% |
| 4 | spur | 498 | 16.9% |
| 5 | spurious_copper | 493 | 16.7% |

**Total**: 2953 objects

## 4. Dataset Structure
PCB_DATASET/
├── images/
│ ├── Missing_hole/
│ ├── Mouse_bite/
│ ├── Open_circuit/
│ ├── Short/
│ ├── Spur/
│ └── Spurious_copper/
├── Annotations/
│ ├── Missing_hole/
│ ├── Mouse_bite/
│ ├── Open_circuit/
│ ├── Short/
│ ├── Spur/
│ └── Spurious_copper/
├── PCB_USED/ # Reference images (tidak untuk training)
└── rotation/ # Rotated images (tidak untuk baseline)

## 5. Image Specifications
- **Format**: JPG
- **Resolution**: Bervariasi (rata-rata ~600x600 pixels)
- **Color Space**: RGB
- **Objects per Image**: Rata-rata 4.26 objects/image (min: 1, max: 10+)

## 6. Dataset Splits
Dataset dibagi menjadi 3 bagian untuk training, validation, dan testing:

### Split Strategy
- **Stratified Split**: Berdasarkan kelas dan grup PCB
- **Leakage Prevention**: Split berdasarkan PCB ID, bukan random image split
- **Ratio**: 
  - Train: ~65% (453 images)
  - Val: ~17% (120 images)
  - Test: ~17% (120 images)

### Split Versions

**Important**: Setiap experiment harus mereferensikan split version yang digunakan.

## 7. Data Policy
- ❌ **Do NOT commit** raw dataset ke Git
- ✅ **Repository should contain**:
  - Dataset documentation (file ini)
  - Scripts untuk preprocessing dan splitting
  - Metadata dan audit reports
  - Download instructions
- ❌ **Do NOT include** raw image collection

## 8. Data Quality
### Validation Results
- ✅ XML tanpa image: 0
- ✅ Image tanpa XML: 0
- ✅ Dimension mismatch: 0
- ✅ Invalid XML: 0
- ✅ Invalid bbox: 0

### Bounding Box Statistics
- **Width mean**: ~50 pixels
- **Height mean**: ~50 pixels
- **Area mean**: ~2500 pixels²
- **Relative area mean**: ~0.7% (small objects)

**Note**: Dataset didominasi oleh small objects (<1% image area), yang menjadi tantangan utama untuk deteksi.

## 9. Augmentation
Augmentation hanya diterapkan pada training partition.

### Current Augmentation Strategy
```python
augmentation_config = {
    "brightness": True,
    "contrast": True,
    "blur": "mild",  # blur_limit=(3, 7)
    "noise": True,
    "rotation": "small",  # max 10 degrees
    "scale": True,  # scale=0.5
    "crop": False,
    "perspective": False,
    "flipud": 0.5,
    "fliplr": 0.5,
    "mosaic": 1.0,
    "mixup": 0.0
}

Important:
❌ Do NOT apply unrealistic transformations
✅ Focus on realistic variations (lighting, slight rotation, scale)
✅ Mosaic augmentation aktif untuk meningkatkan small object detection

10. Supplementary Dataset
Setelah baseline bekerja, pertimbangkan untuk mengumpulkan supplementary dataset menggunakan foto PCB nyata.
Purpose:
Test domain shift
Test camera conditions
Test lighting variation
Test backgrounds
Evaluate transfer learning dari industrial/scanned imagery ke smartphone images
Policy: Supplementary dataset harus disimpan terpisah dari main training dataset untuk meaningful external/generalization test.

11. Dataset Versioning
Setiap experiment harus mereferensikan:
Dataset version
Split version
Augmentation configuration
Model version
Image size
Random seed (jika applicable)
Example:
experiment_config:
  dataset_version: v1
  split_version: v1
  augmentation: mosaic_1.0_flip_0.5
  model_version: yolov8n
  image_size: 640
  seed: 42

12. Known Challenges
Small Objects: Sebagian besar cacat <1% image area
Class Balance: Relatif balanced, tapi beberapa kelas memiliki variasi bentuk yang tinggi
Background Complexity: Background PCB yang kompleks dapat menyebabkan false positives
Annotation Quality: Beberapa bounding box mungkin tidak tight (perlu visual validation)

13. Data Pipeline
Raw Dataset (Pascal VOC)
    ↓
Audit & Validation (audit_dataset.py)
    ↓
Convert to YOLO Format
    ↓
Split by PCB ID (leakage-safe)
    ↓
Apply Augmentation (training only)
    ↓
Convert to YOLO Format (if needed)
    ↓
Training Ready

14. Scripts
audit_dataset.py: Audit dataset tanpa mengubah file original
visualize_annotations.py: Visual validation annotations
convert_voc_to_yolo.py: Convert Pascal VOC ke YOLO format
split_dataset.py: Split dataset berdasarkan PCB ID

15. References
Dataset audit report: audit_report.json
Visual samples: audit_samples/
Split configuration: splits/
