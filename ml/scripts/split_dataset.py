#!/usr/bin/env python3
"""
Leakage-safe split berdasarkan kelompok PCB (PCB ID).
Membagi 10 kelompok PCB (01, 04, 05, ...) menjadi Train/Val/Test.
Mengabaikan folder 'rotation' dan 'PCB_USED'.
"""
import argparse
import json
import random
import re
from pathlib import Path
from collections import defaultdict

def get_pcb_id(filename: str) -> str | None:
    """Mengambil ID PCB dari nama file (misal: 01_missing_hole_09.jpg -> 01)"""
    match = re.match(r"^(\d+)_", Path(filename).name)
    return match.group(1) if match else None

def collect_groups(root: Path) -> dict[str, list[str]]:
    """Scan folder images, kembalikan dict {pcb_id: [list_of_image_paths]}"""
    images_dir = root / "images"
    groups = defaultdict(list)
    for img_path in images_dir.rglob("*"):
        if img_path.is_file() and img_path.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp"):
            group_id = get_pcb_id(img_path.name)
            if group_id:
                groups[group_id].append(str(img_path.relative_to(root)))
    return groups

def main():
    parser = argparse.ArgumentParser(description="Buat split leakage-safe berbasis kelompok PCB")
    parser.add_argument("--dataset-root", type=str, required=True,
                        help="Path ke folder PCB_DATASET")
    parser.add_argument("--output-dir", type=str, default="splits",
                        help="Folder output untuk menyimpan file txt")
    parser.add_argument("--seed", type=int, default=42,
                        help="Seed untuk randomisasi")
    parser.add_argument("--train-ratio", type=float, default=0.8,
                        help="Rasio kelompok untuk train (default: 0.8)")
    parser.add_argument("--val-ratio", type=float, default=0.1,
                        help="Rasio kelompok untuk val (default: 0.1)")
    parser.add_argument("--test-ratio", type=float, default=0.1,
                        help="Rasio kelompok untuk test (default: 0.1)")
    args = parser.parse_args()

    root = Path(args.dataset_root).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: Folder tidak ditemukan: {root}")
        return 1

    # Kumpulkan kelompok dari folder images (abaikan rotation dan PCB_USED)
    groups = collect_groups(root)
    group_ids = sorted(groups.keys())
    
    # Validasi bahwa folder rotation dan PCB_USED tidak ikut terhitung
    print(f"Jumlah kelompok PCB ditemukan: {len(group_ids)}")
    print(f"Kelompok: {group_ids}")
    print("Catatan: Folder 'rotation' dan 'PCB_USED' diabaikan secara otomatis.")

    # Rasio split (pastikan jumlahnya 1.0)
    total_ratio = args.train_ratio + args.val_ratio + args.test_ratio
    if abs(total_ratio - 1.0) > 1e-6:
        print(f"ERROR: Rasio harus berjumlah 1.0 (sekarang: {total_ratio})")
        return 1

    # Hitung jumlah kelompok per split
    n_groups = len(group_ids)
    n_train = round(n_groups * args.train_ratio)
    n_val = round(n_groups * args.val_ratio)
    n_test = n_groups - n_train - n_val
    
    # Jika hasil pembulatan kurang/lebih, sesuaikan (prioritas test, lalu val)
    if n_test < 1: n_test = 1
    if n_val < 1: n_val = 1
    if n_train + n_val + n_test > n_groups:
        n_train = n_groups - n_val - n_test
    if n_train < 1: n_train = 1
    
    # Shuffle kelompok dengan seed deterministik
    rng = random.Random(args.seed)
    shuffled_groups = group_ids.copy()
    rng.shuffle(shuffled_groups)

    train_groups = shuffled_groups[:n_train]
    val_groups = shuffled_groups[n_train:n_train + n_val]
    test_groups = shuffled_groups[n_train + n_val:]

    print(f"\n=== SPLIT RESULT (Seed {args.seed}) ===")
    print(f"Train: {len(train_groups)} kelompok -> {train_groups}")
    print(f"Val  : {len(val_groups)} kelompok -> {val_groups}")
    print(f"Test : {len(test_groups)} kelompok -> {test_groups}")

    # Tulis file txt
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    splits = {"train": train_groups, "val": val_groups, "test": test_groups}
    summary = {"seed": args.seed, "groups": splits}

    for split_name, group_list in splits.items():
        file_paths = []
        for gid in group_list:
            file_paths.extend(groups[gid])
        output_file = output_dir / f"{split_name}.txt"
        output_file.write_text("\n".join(file_paths) + "\n", encoding="utf-8")
        print(f"File {split_name}.txt berisi {len(file_paths)} gambar.")

        # Simpan juga daftar kelompok
        summary[split_name] = {"groups": group_list, "count": len(file_paths)}

    # Simpan summary JSON
    with open(output_dir / "split_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\nSplit selesai. File disimpan di: {output_dir}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())