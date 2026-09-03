"""Ekstrak patch background 640px dari foto PCB real (ml/data/negatives).

Latar: model (E03V2) false-positive pada board berpopulasi (teks silkscreen,
via, komponen) karena data latih = bare board. Patch dari foto real board
BAGUS + label kosong mengajarkan model bahwa struktur itu = background.

Strategi 1 board -> puluhan patch (seperti DeepPCB: 693 gambar dari 10 board):
sliding window overlapping + filter kualitas (buang bar hitam viewer, area
datar, blur). Output HANYA untuk train (val/test tetap bersih).

Contoh:
  ../venv/Scripts/python.exe ml/scripts/extract_background.py
"""

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 640
STRIDE = 320


def patch_ok(a: np.ndarray) -> tuple[bool, str]:
    """Filter kualitas patch (array HxWx3 uint8)."""
    if a.shape[0] < SIZE or a.shape[1] < SIZE:
        return False, "kekecilan"
    g = a.astype(np.float32).mean(-1)
    if (g < 15).mean() > 0.50:
        return False, "bar-hitam"
    if g.mean() < 25 or g.mean() > 235:
        return False, "terlalu-gelap-terang"
    if g.std() < 12:
        return False, "datar"
    return True, "ok"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="ml/data/negatives")
    ap.add_argument("--out", default="ml/data/e06_background")
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[2]
    src, out = root / args.src, root / args.out
    img_dir, lbl_dir = out / "images", out / "labels"
    img_dir.mkdir(parents=True, exist_ok=True)
    lbl_dir.mkdir(parents=True, exist_ok=True)

    stats: dict = {"kept": 0, "rejected": {}, "files": []}
    thumbs = []
    for p in sorted(src.iterdir()):
        if p.suffix.lower() not in (".jpg", ".jpeg", ".png", ".bmp"):
            continue
        img = Image.open(p).convert("RGB")
        w, h = img.size
        n = 0
        for y in range(0, h - SIZE + 1, STRIDE):
            for x in range(0, w - SIZE + 1, STRIDE):
                crop = img.crop((x, y, x + SIZE, y + SIZE))
                ok, why = patch_ok(np.asarray(crop))
                if not ok:
                    stats["rejected"][why] = stats["rejected"].get(why, 0) + 1
                    continue
                name = f"{p.stem}_y{y}_x{x}.jpg"
                crop.save(img_dir / name, quality=92)
                (lbl_dir / (Path(name).stem + ".txt")).write_text("")
                stats["kept"] += 1
                n += 1
                if len(thumbs) < 24:
                    thumbs.append(crop.resize((160, 160)))
        stats["files"].append({"src": p.name, "size": [w, h], "kept": n})
        print(f"{p.name} {w}x{h} -> {n} patch")

    # contact sheet untuk inspeksi visual
    if thumbs:
        cols = 6
        rows = (len(thumbs) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * 160, rows * 160), "black")
        for i, t in enumerate(thumbs):
            sheet.paste(t, ((i % cols) * 160, (i // cols) * 160))
        sheet.save(out / "contact_sheet.jpg", quality=88)

    (out / "stats.json").write_text(json.dumps(stats, indent=2))
    print(f"\nTOTAL kept={stats['kept']} rejected={stats['rejected']}")
    print(f"Lihat {out / 'contact_sheet.jpg'} untuk cek visual.")


if __name__ == "__main__":
    main()
