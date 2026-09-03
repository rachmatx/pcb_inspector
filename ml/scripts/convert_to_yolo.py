#!/usr/bin/env python3
"""
Konversi dataset Pascal VOC DeepPCB ke format YOLO.
Membaca split dari train.txt/val/test.txt.
Mendukung struktur Annotations dengan subfolder per kelas.
"""

import argparse
import shutil
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

# Mapping class -> index (sesuai audit)
CLASS_MAP = {
    "missing_hole": 0,
    "mouse_bite": 1,
    "open_circuit": 2,
    "short": 3,
    "spur": 4,
    "spurious_copper": 5,
}

def parse_xml(xml_path):
    """Parse Pascal VOC XML, return list of (class_name, xmin, ymin, xmax, ymax) and image size."""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    # Ambil dimensi gambar dari XML
    size = root.find("size")
    img_w = float(size.find("width").text) if size is not None and size.find("width") is not None else None
    img_h = float(size.find("height").text) if size is not None and size.find("height") is not None else None
    
    objects = []
    for obj in root.findall("object"):
        name = obj.find("name").text.strip()
        bbox = obj.find("bndbox")
        xmin = float(bbox.find("xmin").text)
        ymin = float(bbox.find("ymin").text)
        xmax = float(bbox.find("xmax").text)
        ymax = float(bbox.find("ymax").text)
        objects.append((name, xmin, ymin, xmax, ymax))
    return objects, img_w, img_h

def main():
    parser = argparse.ArgumentParser(description="Convert Pascal VOC to YOLO format")
    parser.add_argument("--dataset-root", required=True, help="Path ke PCB_DATASET root")
    parser.add_argument("--split-dir", default="splits", help="Folder berisi train.txt/val.txt/test.txt")
    parser.add_argument("--output-dir", default="yolo_dataset", help="Folder output untuk dataset YOLO")
    args = parser.parse_args()

    root = Path(args.dataset_root).expanduser().resolve()
    split_dir = Path(args.split_dir).expanduser().resolve()
    out_dir = Path(args.output_dir).expanduser().resolve()

    # Pastikan folder split ada
    for split in ["train", "val", "test"]:
        if not (split_dir / f"{split}.txt").exists():
            print(f"ERROR: {split_dir / f'{split}.txt'} tidak ditemukan.")
            sys.exit(1)

    # Buat struktur output
    for split in ["train", "val", "test"]:
        (out_dir / split / "images").mkdir(parents=True, exist_ok=True)
        (out_dir / split / "labels").mkdir(parents=True, exist_ok=True)

    # Kelas list
    classes = list(CLASS_MAP.keys())
    total_images = 0
    total_boxes = 0
    missing_xml_count = 0

    for split in ["train", "val", "test"]:
        txt_path = split_dir / f"{split}.txt"
        lines = txt_path.read_text(encoding="utf-8").strip().splitlines()
        for line in lines:
            if not line:
                continue
            # Path relatif dari txt (misal: images\Missing_hole\01_missing_hole_01.jpg)
            img_rel = Path(line.replace("\\", "/"))  # Normalisasi separator
            img_path = (root / img_rel).resolve()

            if not img_path.exists():
                print(f"WARNING: Gambar tidak ditemukan: {img_path}")
                continue

            # Cari XML yang bersesuaian
            stem = img_path.stem
            
            # Strategi 1: Cari di subfolder yang sama dengan gambar (Images/Missing_hole -> Annotations/Missing_hole)
            # relative_xml_dir = root / "Annotations" / img_rel.parent.name
            # Strategi 2: Cari di seluruh folder Annotations menggunakan rglob
            xml_path = None
            for candidate in (root / "Annotations").rglob(f"{stem}.xml"):
                xml_path = candidate
                break
            
            if xml_path is None:
                missing_xml_count += 1
                print(f"WARNING: XML tidak ditemukan untuk {stem}. Melewati gambar ini.")
                continue

            # Parse XML
            objects, img_w, img_h = parse_xml(xml_path)

            # Tentukan nama kelas dan koordinat
            with open(out_dir / split / "labels" / f"{stem}.txt", "w") as f:
                for name, xmin, ymin, xmax, ymax in objects:
                    if name not in CLASS_MAP:
                        print(f"WARNING: Kelas '{name}' tidak dikenal, dilewati.")
                        continue
                    class_id = CLASS_MAP[name]
                    
                    # Fallback: Jika img_w/img_h tidak ada di XML, baca dari gambar
                    if img_w is None or img_h is None:
                        from PIL import Image
                        with Image.open(img_path) as im:
                            img_w, img_h = im.size

                    x_center = (xmin + xmax) / 2 / img_w
                    y_center = (ymin + ymax) / 2 / img_h
                    width = (xmax - xmin) / img_w
                    height = (ymax - ymin) / img_h

                    f.write(f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}\n")
                    total_boxes += 1

            # Salin gambar ke folder images
            shutil.copy2(img_path, out_dir / split / "images" / img_path.name)
            total_images += 1

    # Buat data.yaml
    data_yaml = out_dir / "data.yaml"
    # Gunakan path absolut dengan slash (/) agar kompatibel dengan YOLO
    with open(data_yaml, "w") as f:
        f.write(f"path: {out_dir.as_posix()}\n")
        f.write(f"train: {out_dir / 'train' / 'images'}\n")
        f.write(f"val: {out_dir / 'val' / 'images'}\n")
        f.write(f"test: {out_dir / 'test' / 'images'}\n")
        f.write(f"nc: {len(classes)}\n")
        f.write(f"names: {classes}\n")

    print(f"Selesai! Total gambar: {total_images}, total boxes: {total_boxes}")
    print(f"Jumlah XML tidak ditemukan: {missing_xml_count}")
    print(f"Dataset YOLO disimpan di: {out_dir}")
    print(f"data.yaml: {data_yaml}")

if __name__ == "__main__":
    main()