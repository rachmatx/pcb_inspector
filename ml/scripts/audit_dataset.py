#!/usr/bin/env python3
"""Read-only audit for the PCB_DATASET Pascal VOC dataset."""

import argparse
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean, median

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow belum terinstall. Jalankan: pip install pillow")
    sys.exit(1)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}
EXPECTED_CLASSES = {
    "missing_hole", "mouse_bite", "open_circuit",
    "short", "spur", "spurious_copper"
}


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def pcb_id(filename):
    m = re.match(r"^(\d+)_", Path(filename).name)
    return m.group(1) if m else None


def files(root, extensions):
    return sorted(
        p for p in root.rglob("*")
        if p.is_file() and p.suffix.lower() in extensions
    )


def txt(node, tag):
    x = node.find(tag) if node is not None else None
    return x.text.strip() if x is not None and x.text else None


def parse_xml(path):
    result = {
        "valid": False, "filename": None, "width": None, "height": None,
        "depth": None, "objects": [], "errors": []
    }
    try:
        root = ET.parse(path).getroot()
    except (ET.ParseError, OSError) as e:
        result["errors"].append(str(e))
        return result

    result["valid"] = True
    result["filename"] = txt(root, "filename")

    size = root.find("size")
    if size is not None:
        for key in ("width", "height", "depth"):
            value = txt(size, key)
            try:
                result[key] = int(value) if value is not None else None
            except ValueError:
                result["errors"].append(f"Invalid {key}: {value}")

    for obj in root.findall("object"):
        name = txt(obj, "name")
        box = obj.find("bndbox")
        item = {"class": name, "xmin": None, "ymin": None, "xmax": None, "ymax": None}
        if not name:
            result["errors"].append("Object tanpa class")
        if box is None:
            result["errors"].append(f"Object {name!r} tanpa bndbox")
        else:
            for key in ("xmin", "ymin", "xmax", "ymax"):
                value = txt(box, key)
                try:
                    item[key] = float(value) if value is not None else None
                except ValueError:
                    result["errors"].append(f"Invalid {key}: {value}")
        result["objects"].append(item)
    return result


def main():
    ap = argparse.ArgumentParser(description="Audit PCB_DATASET tanpa mengubah dataset.")
    ap.add_argument("--dataset", required=True, help="Path ke folder PCB_DATASET")
    ap.add_argument("--output", default="audit_report.json", help="Path laporan JSON")
    args = ap.parse_args()

    root = Path(args.dataset).expanduser().resolve()
    images_dir = root / "images"
    ann_dir = root / "Annotations"
    used_dir = root / "PCB_USED"
    rotation_dir = root / "rotation"

    if not root.is_dir():
        print(f"ERROR: folder tidak ditemukan: {root}")
        return 1

    image_list = files(images_dir, IMAGE_EXTENSIONS)
    xml_list = sorted(ann_dir.rglob("*.xml")) if ann_dir.exists() else []
    used_list = files(used_dir, IMAGE_EXTENSIONS)

    by_name = defaultdict(list)
    for p in image_list:
        by_name[p.name.lower()].append(p)

    class_counts = Counter()
    folder_images = Counter()
    folder_xml = Counter()
    records = []
    missing_image = []
    image_stem_set = {p.stem.lower() for p in image_list}
    dimension_mismatch = []
    invalid_xml = []
    xml_name_mismatch = []

    for p in image_list:
        try:
            folder_images[p.relative_to(images_dir).parts[0]]
        except (ValueError, IndexError):
            folder_images["ROOT"] += 1
        else:
            folder_images[p.relative_to(images_dir).parts[0]] += 1

    for p in xml_list:
        try:
            folder_xml[p.relative_to(ann_dir).parts[0]]
        except (ValueError, IndexError):
            folder_xml["ROOT"] += 1
        else:
            folder_xml[p.relative_to(ann_dir).parts[0]] += 1

    for xp in xml_list:
        parsed = parse_xml(xp)
        if not parsed["valid"]:
            invalid_xml.append(str(xp.relative_to(root)))
        filename = parsed["filename"]
        matches = by_name.get(filename.lower(), []) if filename else []
        if not matches:
            matches = [p for p in image_list if p.stem.lower() == xp.stem.lower()]

        ip = matches[0] if matches else None
        if ip is None:
            missing_image.append(str(xp.relative_to(root)))

        rec = {
            "annotation": str(xp.relative_to(root)),
            "image": str(ip.relative_to(root)) if ip else None,
            "pcb_id": pcb_id(ip.name if ip else (filename or xp.name)),
            "xml_filename": filename,
            "xml_width": parsed["width"],
            "xml_height": parsed["height"],
            "image_width": None,
            "image_height": None,
            "objects": parsed["objects"],
            "errors": parsed["errors"],
        }

        if ip:
            try:
                with Image.open(ip) as im:
                    rec["image_width"], rec["image_height"] = im.size
            except Exception as e:
                rec["errors"].append(f"Image error: {e}")

            if (
                rec["xml_width"] is not None and rec["xml_height"] is not None
                and rec["image_width"] is not None
                and (rec["xml_width"], rec["xml_height"])
                    != (rec["image_width"], rec["image_height"])
            ):
                dimension_mismatch.append({
                    "image": str(ip.relative_to(root)),
                    "xml": [rec["xml_width"], rec["xml_height"]],
                    "actual": [rec["image_width"], rec["image_height"]]
                })

            if filename and filename.lower() != ip.name.lower():
                xml_name_mismatch.append({
                    "annotation": str(xp.relative_to(root)),
                    "xml_filename": filename,
                    "matched_image": str(ip.relative_to(root))
                })

        for obj in parsed["objects"]:
            if obj["class"]:
                class_counts[obj["class"]] += 1
        records.append(rec)

    images_without_xml = [
        str(p.relative_to(root)) for p in image_list
        if p.stem.lower() not in {x.stem.lower() for x in xml_list}
    ]

    hashes = defaultdict(list)
    hash_errors = []
    for p in image_list:
        try:
            hashes[sha256(p)].append(str(p.relative_to(root)))
        except OSError as e:
            hash_errors.append({"image": str(p.relative_to(root)), "error": str(e)})
    duplicate_groups = [v for v in hashes.values() if len(v) > 1]

    bbox_widths, bbox_heights, bbox_areas, rel_areas = [], [], [], []
    invalid_boxes = []

    groups = defaultdict(lambda: {
        "images": 0, "annotations": 0, "objects": 0, "classes": Counter()
    })
    for p in image_list:
        gid = pcb_id(p.name)
        if gid:
            groups[gid]["images"] += 1

    for r in records:
        gid = r["pcb_id"]
        if gid:
            groups[gid]["annotations"] += 1
            groups[gid]["objects"] += len(r["objects"])
        for i, o in enumerate(r["objects"], 1):
            if gid:
                groups[gid]["classes"][o["class"]] += 1
            vals = [o["xmin"], o["ymin"], o["xmax"], o["ymax"]]
            if any(v is None for v in vals):
                invalid_boxes.append({
                    "image": r["image"], "object_index": i, "reason": "missing coordinate"
                })
                continue
            w, h = o["xmax"] - o["xmin"], o["ymax"] - o["ymin"]
            if w <= 0 or h <= 0:
                invalid_boxes.append({
                    "image": r["image"], "object_index": i,
                    "reason": f"non-positive size {w}x{h}"
                })
                continue
            if r["image_width"] and r["image_height"]:
                if o["xmin"] < 0 or o["ymin"] < 0 or o["xmax"] > r["image_width"] or o["ymax"] > r["image_height"]:
                    invalid_boxes.append({
                        "image": r["image"], "object_index": i,
                        "reason": "bbox outside image bounds"
                    })
                area = w * h
                bbox_widths.append(w)
                bbox_heights.append(h)
                bbox_areas.append(area)
                rel_areas.append(100 * area / (r["image_width"] * r["image_height"]))

    def stats(v):
        return {
            "min": min(v) if v else None,
            "max": max(v) if v else None,
            "mean": mean(v) if v else None,
            "median": median(v) if v else None
        }

    groups_json = {
        gid: {
            "images": g["images"],
            "annotations": g["annotations"],
            "objects": g["objects"],
            "classes": dict(g["classes"])
        }
        for gid, g in sorted(groups.items())
    }

    report = {
        "dataset": str(root),
        "read_only": True,
        "counts": {
            "images": len(image_list),
            "xml_annotations": len(xml_list),
            "total_objects": sum(class_counts.values()),
            "pcb_used_images": len(used_list),
            "inferred_pcb_groups": len(groups_json)
        },
        "images_by_folder": dict(folder_images),
        "annotations_by_folder": dict(folder_xml),
        "classes": dict(sorted(class_counts.items())),
        "objects_per_image": {
            "min": min([len(r["objects"]) for r in records], default=None),
            "max": max([len(r["objects"]) for r in records], default=None),
            "mean": mean([len(r["objects"]) for r in records]) if records else None,
            "median": median([len(r["objects"]) for r in records]) if records else None
        },
        "bbox_statistics": {
            "width_px": stats(bbox_widths),
            "height_px": stats(bbox_heights),
            "area_px2": stats(bbox_areas),
            "relative_area_percent": stats(rel_areas),
            "invalid_boxes": invalid_boxes
        },
        "matching": {
            "xml_without_image": missing_image,
            "image_without_xml": images_without_xml,
            "dimension_mismatch": dimension_mismatch,
            "xml_filename_mismatch": xml_name_mismatch,
            "invalid_xml": invalid_xml
        },
        "duplicates": {
            "groups": duplicate_groups,
            "hash_errors": hash_errors
        },
        "pcb_groups": groups_json,
        "class_check": {
            "missing_expected": sorted(EXPECTED_CLASSES - set(class_counts)),
            "unexpected": sorted(set(class_counts) - EXPECTED_CLASSES)
        },
        "directories": {
            "PCB_USED_exists": used_dir.exists(),
            "rotation_exists": rotation_dir.exists(),
            "rotation_used_for_baseline": False
        }
    }

    out = Path(args.output).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print("=" * 70)
    print("PCB DATASET AUDIT")
    print("=" * 70)
    print(f"Dataset              : {root}")
    print(f"Images               : {len(image_list)}")
    print(f"XML                  : {len(xml_list)}")
    print(f"Objects              : {sum(class_counts.values())}")
    print(f"PCB groups           : {len(groups_json)}")
    print(f"PCB_USED images      : {len(used_list)}")
    print()
    print("Classes:")
    for c, n in sorted(class_counts.items()):
        print(f"  {c:<20} {n}")
    print()
    print("Validation:")
    print(f"  XML tanpa image    : {len(missing_image)}")
    print(f"  Image tanpa XML    : {len(images_without_xml)}")
    print(f"  Dimension mismatch : {len(dimension_mismatch)}")
    print(f"  Invalid XML        : {len(invalid_xml)}")
    print(f"  Invalid bbox       : {len(invalid_boxes)}")
    print(f"  Duplicate groups   : {len(duplicate_groups)}")
    print()
    print("Bounding boxes:")
    print(f"  Width  mean        : {stats(bbox_widths)['mean']}")
    print(f"  Height mean        : {stats(bbox_heights)['mean']}")
    print(f"  Area   mean        : {stats(bbox_areas)['mean']}")
    print(f"  Relative area mean : {stats(rel_areas)['mean']}%")
    print()
    print("PCB groups:")
    for gid, g in groups_json.items():
        print(f"  PCB {gid:<4} images={g['images']:<4} annotations={g['annotations']:<4} objects={g['objects']}")
    print()
    print("Policy:")
    print("  rotation/  -> ignored for baseline")
    print("  PCB_USED/  -> reference/source, not training images")
    print("  split      -> group-based by PCB source")
    print()
    print(f"Report JSON: {out}")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
