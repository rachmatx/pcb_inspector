#!/usr/bin/env python3
"""
Visual validation of Pascal VOC annotations in PCB_DATASET.

This script:
- reads images from images/
- reads matching Pascal VOC XML files from Annotations/
- draws bounding boxes and class names
- saves sample images to an output directory
- DOES NOT modify the original dataset

Usage:
    python visualize_annotations.py --dataset "C:\\path\\to\\PCB_DATASET"

Optional:
    python visualize_annotations.py --dataset ./PCB_DATASET --samples 12
    python visualize_annotations.py --dataset ./PCB_DATASET --samples 12 --seed 42
    python visualize_annotations.py --dataset ./PCB_DATASET --samples 12 --pcb 01
"""

import argparse
import random
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("ERROR: Pillow belum terinstall.")
    print("Jalankan: pip install pillow")
    sys.exit(1)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}


def find_font(size=24):
    candidates = [
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        p = Path(path)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except OSError:
                pass
    return ImageFont.load_default()


def parse_annotation(xml_path):
    """Return filename and list of VOC bounding boxes."""
    root = ET.parse(xml_path).getroot()

    filename_node = root.find("filename")
    filename = (
        filename_node.text.strip()
        if filename_node is not None and filename_node.text
        else None
    )

    boxes = []

    for obj in root.findall("object"):
        name_node = obj.find("name")
        bbox = obj.find("bndbox")

        if name_node is None or not name_node.text or bbox is None:
            continue

        try:
            xmin = int(float(bbox.findtext("xmin")))
            ymin = int(float(bbox.findtext("ymin")))
            xmax = int(float(bbox.findtext("xmax")))
            ymax = int(float(bbox.findtext("ymax")))
        except (TypeError, ValueError):
            continue

        boxes.append({
            "class": name_node.text.strip(),
            "xmin": xmin,
            "ymin": ymin,
            "xmax": xmax,
            "ymax": ymax,
        })

    return filename, boxes


def collect_samples(dataset, count, seed, pcb_filter=None):
    images_dir = dataset / "images"
    annotations_dir = dataset / "Annotations"

    image_files = sorted(
        p for p in images_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )

    if pcb_filter:
        image_files = [
            p for p in image_files
            if p.name.startswith(f"{pcb_filter}_")
        ]

    candidates = []

    for image_path in image_files:
        # Search by stem. Dataset has matching names in images/ and Annotations/.
        matches = list(annotations_dir.rglob(f"{image_path.stem}.xml"))

        if matches:
            candidates.append((image_path, matches[0]))

    if not candidates:
        return []

    rng = random.Random(seed)
    rng.shuffle(candidates)

    return candidates[:min(count, len(candidates))]


def draw_annotation(image, boxes, line_width):
    draw = ImageDraw.Draw(image)
    font = find_font(max(18, image.width // 150))

    for box in boxes:
        xmin = box["xmin"]
        ymin = box["ymin"]
        xmax = box["xmax"]
        ymax = box["ymax"]
        label = box["class"]

        # Draw bounding box.
        for offset in range(line_width):
            draw.rectangle(
                [
                    xmin - offset,
                    ymin - offset,
                    xmax + offset,
                    ymax + offset,
                ],
                outline="red",
            )

        # Label background.
        text_bbox = draw.textbbox((0, 0), label, font=font)
        text_w = text_bbox[2] - text_bbox[0]
        text_h = text_bbox[3] - text_bbox[1]

        label_x = xmin
        label_y = max(0, ymin - text_h - 8)

        draw.rectangle(
            [
                label_x,
                label_y,
                label_x + text_w + 10,
                label_y + text_h + 8,
            ],
            fill="red",
        )
        draw.text(
            (label_x + 5, label_y + 4),
            label,
            fill="white",
            font=font,
        )

    return image


def main():
    parser = argparse.ArgumentParser(
        description="Visual validation of PCB Pascal VOC annotations."
    )
    parser.add_argument(
        "--dataset",
        required=True,
        help="Path ke folder PCB_DATASET",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=12,
        help="Jumlah sample yang dibuat (default: 12)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed (default: 42)",
    )
    parser.add_argument(
        "--pcb",
        default=None,
        help="Opsional: hanya sample dari PCB ID tertentu, misalnya 01",
    )
    parser.add_argument(
        "--output",
        default="audit_samples",
        help="Folder output (default: audit_samples)",
    )
    parser.add_argument(
        "--line-width",
        type=int,
        default=5,
        help="Ketebalan bounding box (default: 5)",
    )

    args = parser.parse_args()

    dataset = Path(args.dataset).expanduser().resolve()

    if not dataset.is_dir():
        print(f"ERROR: dataset tidak ditemukan: {dataset}")
        return 1

    if args.samples < 1:
        print("ERROR: --samples harus >= 1")
        return 1

    samples = collect_samples(
        dataset,
        args.samples,
        args.seed,
        args.pcb,
    )

    if not samples:
        print("ERROR: tidak menemukan pasangan image + XML.")
        return 1

    output_dir = Path(args.output).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("PCB ANNOTATION VISUAL VALIDATION")
    print("=" * 70)
    print(f"Dataset : {dataset}")
    print(f"Samples : {len(samples)}")
    print(f"Seed    : {args.seed}")
    if args.pcb:
        print(f"PCB     : {args.pcb}")
    print(f"Output  : {output_dir}")
    print()

    success = 0

    for index, (image_path, xml_path) in enumerate(samples, start=1):
        try:
            xml_filename, boxes = parse_annotation(xml_path)

            with Image.open(image_path) as original:
                image = original.convert("RGB")
                original_size = image.size

            draw_annotation(image, boxes, args.line_width)

            output_name = (
                f"{index:02d}_{image_path.stem}_annotated.jpg"
            )
            output_path = output_dir / output_name

            # JPEG is convenient for visual inspection.
            image.save(output_path, quality=95)

            print(
                f"[{index:02d}] {image_path.name:<35} "
                f"boxes={len(boxes):<2} "
                f"size={original_size[0]}x{original_size[1]}"
            )

            success += 1

        except Exception as exc:
            print(
                f"[{index:02d}] ERROR {image_path.name}: "
                f"{type(exc).__name__}: {exc}"
            )

    print()
    print(f"Berhasil dibuat : {success}/{len(samples)} sample")
    print(f"Folder output   : {output_dir}")
    print()
    print("CATATAN:")
    print("- Script hanya membaca dataset; file original tidak diubah.")
    print("- Bounding box berasal langsung dari Pascal VOC XML.")
    print("- Untuk baseline, folder rotation/ tidak digunakan.")
    print("=" * 70)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
