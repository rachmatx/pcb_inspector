# RESEARCH PLAN — PCB Inspector

## 1. Working title

**Detection and Localization of Small PCB Defects Using YOLO-Based Object Detection with Image Resolution and Tiling Strategies**

The title may change after literature review and baseline results.

## 2. Research domain

- Computer Vision
- Image Processing
- Artificial Intelligence
- Machine Learning
- Object Detection

## 3. Problem statement

PCB defect detection involves localizing small visual anomalies in circuit-board imagery. The dataset used in this research is the **DeepPCB (Kaggle version)**, containing **693 images** and **2,953 bounding boxes** with six classes: `missing_hole`, `mouse_bite`, `open_circuit`, `short`, `spur`, `spurious_copper`. Small defects often occupy only a small portion of the image area, making them difficult for object detectors to identify at standard resolutions.

## 4. Research question

Primary:

> How do image-resolution and tiling strategies affect the performance of YOLO-based detection of small PCB defects?

Secondary:
1. What is the baseline performance of a pretrained small YOLO detector?
2. Does realistic augmentation improve generalization?
3. Does higher input resolution improve small-defect recall?
4. Does tiling improve localization of tiny defects?
5. What is the trade-off between accuracy and inference speed?

## 5. Hypothesis

Increasing the amount of useful pixel information available to the detector through higher resolution and/or tiling is expected to improve detection of small defects, but may increase computation and inference time.

## 6. Independent variables

Potential:
- image resolution
- tiling strategy
- augmentation configuration

## 7. Dependent variables

- mAP@50
- mAP@50:95
- precision
- recall
- F1-score
- per-class AP
- inference time
- model size

## 8. Controlled variables

Where possible:
- dataset split
- test set
- model family
- training environment
- evaluation procedure

## 9. Methodology

### Stage 1
Literature review.

### Stage 2
Dataset acquisition and audit.

### Stage 3
Dataset preparation.

### Stage 4
Baseline training.

### Stage 5
Controlled experiments.

### Stage 6
Evaluation and error analysis.

### Stage 7
Final model selection.

### Stage 8
Application implementation.

### Stage 9
System evaluation.

### Stage 10
Thesis/journal writing.

## 10. Expected contribution

The project should contribute an empirical comparison of practical strategies for improving small PCB defect detection under a constrained deployment scenario.

The contribution must be stated conservatively and supported by experiments.

## 11. Threats to validity

- dataset may not represent real factory conditions
- DeepPCB imagery comes from a controlled acquisition setup
- smartphone photographs may differ substantially
- dataset augmentation can create unrealistic samples
- model performance may vary across PCB designs
- test-set leakage can inflate results

## 12. External validation

If feasible, collect a small separate set of PCB photographs after the main model is frozen.

Do not use this set to tune the model.

Use it to discuss domain shift and practical limitations.

## 13. Journal outputs

Prepare:
- dataset description
- methodology diagram
- model architecture
- experiment table
- metric comparison
- qualitative detection examples
- error analysis
- limitations
- reproducibility information
