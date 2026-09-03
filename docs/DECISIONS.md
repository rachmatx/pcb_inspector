# DECISIONS — PCB Inspector

This file records important decisions so future development sessions do not repeatedly reconsider settled choices.

## D001 — Project topic

**Decision:** PCB defect detection and localization.

**Reason:** Strong combination of computer vision, machine learning, object detection, dataset availability, research potential, and practical software demonstration.

**Status:** accepted

## D002 — Product structure

**Decision:** One shared backend for web and mobile clients.

**Reason:** Avoid maintaining two independent AI systems and satisfy both web accessibility and Mobile Programming requirements.

**Status:** accepted

## D003 — Training environment

**Decision:** Cloud GPU is the primary training environment.

**Reason:** Local PC has an RX 550 4 GB and is not the preferred CUDA training environment. Local machine remains the development workstation.

**Status:** accepted

## D004 — Initial dataset

**Decision:** Audit DeepPCB first.

**Reason:** Established PCB defect dataset with six defect classes and bounding-box annotations.

**Status:** accepted

## D005 — Model strategy

**Decision:** Start from a pretrained small YOLO model.

**Reason:** Transfer learning reduces training cost and provides a practical baseline.

**Status:** accepted

## D006 — Research focus

**Decision:** Investigate small-defect detection using resolution and tiling strategies.

**Reason:** It creates a measurable research question rather than a simple model-training demonstration.

**Status:** accepted

## D007 — LLM usage

**Decision:** DeepSeek is a development assistant, not part of the product's inference pipeline.

**Reason:** The vision model should perform the actual detection; adding an LLM would increase cost and complexity without helping the core research question.

**Status:** accepted

## D008 — Dataset policy

**Decision:** Do not commit raw datasets or model weights to Git.

**Reason:** repository size, licensing, reproducibility and cleaner version control.

**Status:** accepted

## D009 — Application scope

**Decision:** MVP contains image upload/capture, inference, visualization and result summary.

**Reason:** Keep the project focused on the research contribution.

**Status:** accepted

## D010 — Documentation

**Decision:** Project documentation is the source of truth for architecture, research decisions, dataset versions and experiments.

**Status:** accepted

D011 Model selection
Decision: Use YOLOv8s as the standard model for all experiments.
Reason: YOLOv8s (11.2M parameters) provides significantly better performance than YOLOv8n (3.2M parameters) with acceptable inference time (~15ms at 640px, ~45ms at 1280px).
Status: accepted

D012 Dataset split strategy
Decision: Use PCB group-based split to prevent data leakage.
Reason: Each PCB group contains multiple crops from the same physical PCB. Random split would cause the model to memorize PCB patterns instead of learning defect features.
Split configuration:
- Train: PCB 01, 04, 08, 09, 11, 12 (480 images)
- Val: PCB 06, 07 (121 images)
- Test: PCB 05, 10 (92 images)
Status: accepted

D013 Final model selection
Decision: Select E03 (YOLOv8s @ 1280px) as the final model for production.
Reason: 
- Highest mAP50 (0.957) and mAP50-95 (0.529)
- All defect classes achieve AP50 > 0.93
- Balanced precision (0.972) and recall (0.917)
- Simpler than E05 with identical performance
- Suitable for FastAPI deployment (~45ms inference)
Status: accepted

D014 Tiling strategy evaluation
Decision: Tiling strategy is not suitable for direct metric evaluation but remains valid for deployment with post-processing.
Reason: 
- Per-tile evaluation causes severe metric degradation (mAP50: 0.079)
- Defects split across tile boundaries are counted as separate objects
- Repeated background increases false positives
- Requires NMS merging algorithm for production use
Status: accepted

D015 Experiment methodology
Decision: All experiments use YOLOv8s with PCB group-based split and patience=30-50.
Reason: 
- YOLOv8s provides best performance/cost ratio
- PCB group split ensures leakage-free evaluation
- Higher patience (30-50) allows proper convergence at high resolution
- Learning rate adjusted for resolution (0.001 for 640px, 0.0005 for 1280px)
Status: accepted

## D016 — Out-of-distribution guard (non-PCB images)

Decision: Backend `/predict` returns a heuristic `pcb_score` (soldermask-color
fraction, threshold 0.15 via `PCB_MIN_SCORE`); web shows a warning and skips
auto-save to history when below threshold, but still displays results.
Reason:
- YOLO fires false detections on non-PCB photos (e.g. receipts); silent
  acceptance destroys user trust and pollutes history.
- Calibrated: dataset images ~0.90, white documents/text ~0.00.
- Soft warning (not hard reject) because heuristic is imperfect — black/white
  soldermask PCBs could score low.
- Proper fix later: trained binary PCB/non-PCB classifier with negatives.
Status: accepted

## D019 — Model final: best-e03v2-yolov8s, tanpa retrain lanjutan
Decision: best-e03v2-yolov8s adalah model produksi final (terbaik dari
10x training dataset Kaggle). Backend default = e03v2. Rencana E06
(background fine-tune) DIARSIPKAN atas permintaan eksplisit — tidak ada
pembahasan retrain lanjutan. Perbaikan selanjutnya hanya sisi aplikasi
tanpa training.
Status: accepted

## D016a — OOD heuristic tightening (Phase 1)

Decision: Score = green-saturated-pixel fraction only (drop blue/red);
threshold 0.15 -> 0.40 (`PCB_MIN_SCORE` / frontend `PCB_SCORE_MIN`).
Reason:
- Old hue-union heuristic scored a colorful outdoor photo 0.53 (sky blue,
  orange banner) — above 0.15, so no warning appeared.
- Measurement: green-only gives val-120 min 0.894, colorful/struk/doc 0.0.
  Threshold 0.40 has wide margin on both sides; 0/120 val flagged.
- Known gap: leafy nature photos score ~1.0 (false negative) — documented;
  binary classifier (Phase 2) will address it.
- Banner now shows the score vs threshold for transparency.
Status: accepted

## D017 — Real-world gap: populated & non-green PCBs (observasi 2026-09)

Decision:
1. Warning non-PCB dapat di-override manual per gambar ("Ini PCB — tetap
   simpan"). Heuristik warna tidak akan pernah andal untuk soldermask
   hitam/putih — penilaian akhir di tangan pengguna.
2. Rencana E06: kumpulkan foto real (berpopulasi, biru/hitam, variasi
   cahaya), anotasi, fine-tune dari E03V2. Tanpa data ini tidak ada patch
   yang jujur untuk false positive di board berpopulasi.
Reason (temuan foto asli):
- PCB hijau berpopulasi: 25 deteksi, mayoritas palsu — missing_hole
  menembak huruf silkscreen ("IC3", "V2"), via/komponen dikira defect.
  Dataset latih = bare board; model belum pernah melihat komponen.
- PCB biru & hitam valid: skor 0.00, kena warning. Sesuai prediksi D016a.
- Threshold/preset tak menyelesaikan keduanya (FP ber-confidence 56–75%).
Status: accepted

## D018 — Filter silkscreen DITOLAK (eksperimen negatif, 2026-09)

Decision: TIDAK memasang post-filter keputihan untuk missing_hole.
Reason (pengukuran, bukan opini):
- Fraksi piksel terang (min RGB > 200) di dalam box, model e03v2 @0.45:
  val GT missing_hole (n=61): min 0.000, p90 0.023, maks 0.073.
  Foto real (32 box missing_hole, diasumsikan FP): median 0.07–0.11,
  rentang 0.00–0.31 — median FOTO ≈ maks VAL. Tidak ada ambang yang
  memisahkan keduanya; ambang berapa pun mempertukarkan FP huruf vs
  lubang asli yang kebetulan dekat silkscreen.
- Box huruf ternyata minim piksel putih (goresan tipis di atas background
  gelap) — asumsi "huruf = putih" salah secara kuantitatif.
- Foto di ml/data/negatives/ dipertahankan sebagai hard negative set E06.
Status: accepted (stop jujur sesuai rencana; tidak ada tuning akal-akalan)

## D020 — Test suite (backend pytest + frontend vitest)

Decision: Backend diuji pytest (kontrak /health, /models, /predict:
validasi, 413, gate non-PCB; unit _iou/_nms_fusion/_pcb_score).
Frontend diuji vitest untuk fungsi murni (lib/compare.ts hasil ekstraksi
dari page, lib/colors). Tanpa DOM/component test untuk kini.
Reason: Kredibilitas angka untuk jurnal/sidang; regresi terdeteksi sebelum
screenshot pengguna. Cara jalan: `../venv/Scripts/python -m pytest` dari
backend/, `npm test` dari web/.
Status: accepted

## Change policy

If a decision changes:
1. do not silently modify it
2. record the new decision
3. explain why
4. update affected documents
5. keep the old decision history where useful