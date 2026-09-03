"""Rekam canned responses untuk mode demo offline (P0).

Untuk tiap sampel: prediksi SEMUA model backend pada conf Balance (0.45),
simpan mentah ke web/public/demo/canned.json. Juga buat contoh-struk.png.
"""

import io
import json
import urllib.request
from pathlib import Path
from PIL import Image, ImageDraw

BACKEND = "http://localhost:8000"
CONF = 0.45
HERE = Path(__file__).resolve().parent
CONTOH = HERE / "../web/public/contoh"
DEMO = HERE / "../web/public/demo"
DEMO.mkdir(exist_ok=True)


def make_struk(path: Path):
    r = Image.new("RGB", (500, 800), "white")
    d = ImageDraw.Draw(r)
    d.text((120, 30), "SPARKLEEN", fill="black")
    d.text((90, 70), "Laundry Profesional", fill="black")
    for y in range(140, 740, 26):
        d.rectangle([50, y, 450, y + 12], fill="black")
    r.save(path)


def get_models():
    with urllib.request.urlopen(f"{BACKEND}/models", timeout=30) as r:
        return json.loads(r.read())


def encode_multipart(boundary, fields, files):
    """fields: [(name, value)], files: [(name, filename, ctype, bytes)]."""
    buf = io.BytesIO()
    for name, value in fields:
        buf.write(f"--{boundary}\r\n".encode())
        buf.write(
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        buf.write(f"{value}\r\n".encode())
    for name, filename, ctype, data in files:
        buf.write(f"--{boundary}\r\n".encode())
        buf.write(
            f'Content-Disposition: form-data; name="{name}"; '
            f'filename="{filename}"\r\n'.encode())
        buf.write(f"Content-Type: {ctype}\r\n\r\n".encode())
        buf.write(data)
        buf.write(b"\r\n")
    buf.write(f"--{boundary}--\r\n".encode())
    return buf.getvalue()


def predict(path: Path, model_id: str, conf: float):
    data = path.read_bytes()
    ctype = "image/png" if path.suffix == ".png" else "image/jpeg"
    boundary = "REC1"
    body = encode_multipart(
        boundary,
        [("conf", str(conf)), ("model_id", model_id)],
        [("file", path.name, ctype, data)],
    )
    req = urllib.request.Request(
        f"{BACKEND}/predict", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())


def main():
    make_struk(CONTOH / "contoh-struk.png")
    print("struk dibuat")
    models = get_models()
    print("models:", [m["id"] for m in models["models"]])
    samples = {
        "contoh-open-circuit.jpg": CONTOH / "contoh-open-circuit.jpg",
        "contoh-short.jpg": CONTOH / "contoh-short.jpg",
        "contoh-struk.png": CONTOH / "contoh-struk.png",
    }
    canned = {"conf": CONF, "samples": {}}
    for name, path in samples.items():
        entry = {}
        for m in models["models"]:
            out = predict(path, m["id"], CONF)
            entry[m["id"]] = out
            print(f"{name} x {m['id']}: pcb={out.get('pcb_score')} "
                  f"n={len(out['detections'])} {out['inference_ms']:.0f}ms")
        canned["samples"][name] = entry
    (DEMO / "canned.json").write_text(json.dumps(canned))
    print("OK ->", DEMO / "canned.json")


if __name__ == "__main__":
    main()
