# ROADMAP — PCB Inspector

## Phase 0 — Project setup

Deliverables:
- repository
- documentation
- environment rules
- research question

Exit condition:
- scope is frozen

## Phase 1 — Dataset acquisition

Tasks:
- obtain DeepPCB
- record provenance
- inspect license/usage terms
- build dataset inventory

Exit condition:
- dataset can be reproduced from documented instructions

## Phase 2 — Dataset audit

Tasks:
- inspect images
- inspect annotations
- count classes
- inspect bounding-box sizes
- detect malformed files
- inspect pair relationships
- design leakage-safe split

Exit condition:
- `dataset_v1_clean` exists

## Phase 3 — Baseline ML

Tasks:
- configure cloud GPU
- install ML dependencies
- train pretrained small YOLO
- validate
- test
- save metrics

Exit condition:
- reproducible baseline exists

## Phase 4 — Research experiments

Tasks:
- augmentation experiment
- resolution experiment
- tiling experiment
- compare metrics
- error analysis

Exit condition:
- final experiment table exists

## Phase 5 — Final model

Tasks:
- freeze research configuration
- train/finalize model
- evaluate
- export
- document model metadata

Exit condition:
- final model artifact exists

## Phase 6 — Backend

Tasks:
- FastAPI
- health endpoint
- prediction endpoint
- validation
- model loading
- response schema
- tests

Exit condition:
- image can be submitted and detections returned

## Phase 7 — Web

Tasks:
- upload
- preview
- loading
- result
- bounding boxes
- responsive design

Exit condition:
- complete web MVP

## Phase 8 — Mobile

Tasks:
- Expo setup
- camera
- gallery
- API integration
- result visualization

Exit condition:
- mobile client uses the same backend

## Phase 9 — Integration

Tasks:
- end-to-end testing
- error handling
- performance measurement
- deployment

Exit condition:
- public demo works reliably

## Phase 10 — Research writing

Tasks:
- methodology
- experiments
- results
- discussion
- limitations
- conclusion

Exit condition:
- thesis/journal draft complete

## Progress status (2026-09-03)

Status per phase relatif terhadap target di atas:

- **Phase 0–2 — ✅ done**: repository & documentation, dataset acquisition (PCB Defect Dataset, 693 images), and dataset audit (`ml/scripts/audit_dataset.py` + `audit_report.json`).
- **Phase 3–5 — ✅ done**: baseline and experiments E01–E05 recorded in `docs/EXPERIMENTS.md`; **production model E05 (YOLOv8s @ 1280px)** + threshold sweep E16; artifacts under `artifacts/`.
- **Phase 6 — ✅ done**: FastAPI backend (`backend/main.py`) with `GET /health`, `GET /models`, `POST /predict`; multi-model `*.pt` discovery; test suite `backend/tests/` (12 passed).
- **Phase 7 — ✅ done (beyond MVP)**: `/inspect` (queue, sensitivity presets, compare, ZoomableViewer, exports), `/history` + auth, `/model` Model Card, `?demo=1` offline mode; frontend tests 18 passed.
- **Phase 8 — ⏳ not started**: no `mobile/` app.
- **Phase 9 — 🟡 in progress**: monorepo git, DB migrated to Turso, deploy setup (Vercel frontend + HF Spaces backend).
- **Phase 10 — ⏳ not started**: thesis/journal draft.

## Important rule

Do not start Phase 7 because the UI looks exciting if Phase 3 is not complete.

The model is the core research artifact.
