"""Sweep threshold 0.20-0.70 pada prediksi mentah val (E05, ensemble 1280+1600).

Setara backend/main.py: NMS-fusion greedy per kelas (IoU>0.50, simpan conf
tertinggi) + filter threshold. (Threshold dulu vs fusion dulu ekuivalen
untuk greedy keep-highest: box ber-conf rendah tak pernah menekan box
ber-conf lebih tinggi.) Matching ke GT greedy per kelas IoU>=0.50.
Metrik: micro P/R/F1 + P/R/F1 per kelas per threshold.
"""

import json
import os
from pathlib import Path
from PIL import Image

# Bisa dioverride: VAL_RAW_JSON=/path/ke/val_raw.json
RAW = Path(os.environ.get("VAL_RAW_JSON", "../artifacts/val_raw.json"))
LBL = Path("../ml/data/processed/yolo_dataset/val/labels")
IMG = Path("../ml/data/processed/yolo_dataset/val/images")
NAMES = ["missing_hole", "mouse_bite", "open_circuit", "short", "spur",
         "spurious_copper"]
THRESHOLDS = [round(0.20 + 0.05 * i, 2) for i in range(11)]


def area(b):
    return max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])


def iou(a, b):
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    u = area(a) + area(b) - inter
    return inter / u if u > 0 else 0.0


def load_gt():
    out = {}
    for img_path in sorted(IMG.glob("*.jpg")):
        w, h = Image.open(img_path).size
        per_cls = {cid: [] for cid in range(6)}
        lp = LBL / (img_path.stem + ".txt")
        if lp.exists():
            for line in lp.read_text().splitlines():
                parts = line.split()
                cid = int(float(parts[0]))
                _, cx, cy, bw, bh = map(float, parts)
                per_cls[cid].append([(cx - bw / 2) * w, (cy - bh / 2) * h,
                                     (cx + bw / 2) * w, (cy + bh / 2) * h])
        out[img_path.name] = per_cls
    return out


def main():
    rows = json.loads(RAW.read_text())
    gt = load_gt()
    n_gt = sum(len(v) for per in gt.values() for v in per.values())
    print(f"{len(rows)} gambar val, {n_gt} GT, threshold 0.20-0.70")
    print(f"{'thr':>5} {'P':>7} {'R':>7} {'F1':>7}")

    summary = {}
    for thr in THRESHOLDS:
        micro_tp = micro_fp = micro_fn = 0
        per_cls = {}
        for cid in range(6):
            tp = fp = fn = 0
            for row in rows:
                cand = [d for d in row["res"]["1280"] + row["res"]["1600"]
                        if d["cls"] == cid and d["conf"] >= thr]
                cand.sort(key=lambda d: -d["conf"])
                kept = []
                for d in cand:
                    if any(iou(d["bbox"], k["bbox"]) > 0.5 for k in kept):
                        continue
                    kept.append(d)
                gts = gt[row["img"]][cid]
                used = [False] * len(gts)
                hit = 0
                for p in kept:
                    bi, bv = -1, 0.0
                    for j, g in enumerate(gts):
                        if used[j]:
                            continue
                        v = iou(p["bbox"], g)
                        if v > bv:
                            bv, bi = v, j
                    if bv >= 0.5:
                        used[bi] = True
                        hit += 1
                tp += hit
                fp += len(kept) - hit
                fn += len(gts) - hit
            micro_tp += tp
            micro_fp += fp
            micro_fn += fn
            P = tp / (tp + fp) if tp + fp else 0.0
            R = tp / (tp + fn) if tp + fn else 0.0
            F = 2 * P * R / (P + R) if P + R else 0.0
            per_cls[cid] = (P, R, F, tp, fp, fn)
        P = micro_tp / (micro_tp + micro_fp)
        R = micro_tp / (micro_tp + micro_fn)
        F = 2 * P * R / (P + R)
        summary[thr] = (P, R, F, per_cls)
        print(f"{thr:>5.2f} {P:>7.4f} {R:>7.4f} {F:>7.4f}")

    best = max(THRESHOLDS, key=lambda t: summary[t][2])
    P, R, F, _ = summary[best]
    print(f"\nF1-maks mikro: thr={best:.2f} P={P:.4f} R={R:.4f} F1={F:.4f}\n")
    for cid in range(6):
        row = "  ".join(
            f"{t:.2f}:F1={summary[t][3][cid][2]:.3f}" for t in THRESHOLDS
        )
        bt = max(THRESHOLDS, key=lambda t: summary[t][3][cid][2])
        print(f"{NAMES[cid]:<15} F1-maks @ {bt:.2f} | {row}")


if __name__ == "__main__":
    main()
