# Entry-point untuk Hugging Face Spaces (SDK Gradio, hardware CPU Basic).
# Spaces me-routing HTTP ke port 7860 apa pun framework-nya, jadi API
# FastAPI (main.py) bisa diserve langsung via uvicorn — kontrak
# /health & /predict untuk frontend tidak berubah.
import uvicorn

from main import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
