import { CLASS_META, classColor } from "./colors";

export type Detection = {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
};

export type PredictionResponse = {
  model_id?: string;
  model_display?: string;
  model_version: string;
  inference_ms: number;
  detections: Detection[];
  /** Skor kemiripan-PCB 0..1 dari backend (opsional, backend lama). */
  pcb_score?: number;
};

/** Di bawah ini gambar dianggap bukan PCB — hasil tidak valid & tak disimpan. */
export const PCB_SCORE_MIN = 0.4;

export const isNonPcb = (data: PredictionResponse): boolean =>
  typeof data.pcb_score === "number" && data.pcb_score < PCB_SCORE_MIN;

export type HealthResponse = {
  status: string;
  model: string;
  models?: string[];
};

export type ModelInfo = { id: string; display: string };
export type ModelsResponse = { default: string; models: ModelInfo[] };

export type ReviewStatus = "" | "tp" | "fp" | "miss";

export type HistoryItem = {
  id: string;
  imageName: string;
  modelVersion: string;
  inferenceMs: number;
  defectCount: number;
  detections: Detection[];
  thumbnail: string | null;
  review: ReviewStatus;
  imageWidth: number | null;
  imageHeight: number | null;
  threshold: number | null;
  createdAt: Date;
};

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function checkHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}

/** Kirim gambar + (opsional) conf & model — untuk eksplorasi & pembandingan. */
export async function predictImage(
  file: File,
  opts?: { conf?: number; modelId?: string },
): Promise<PredictionResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (opts?.conf !== undefined) formData.append("conf", String(opts.conf));
  if (opts?.modelId) formData.append("model_id", opts.modelId);

  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let detail = "Server error";
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // body bukan JSON; pakai pesan default
    }
    throw new Error(detail);
  }

  return (await res.json()) as PredictionResponse;
}

/** Ambil daftar model yang tersedia di backend. */
export async function fetchModels(): Promise<ModelInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/models`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as ModelsResponse;
    return data.models;
  } catch {
    return [];
  }
}

/** Ambil ID model default backend (null bila tak terjangkau). */
export async function fetchModelDefault(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/models`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as ModelsResponse;
    return data.default ?? null;
  } catch {
    return null;
  }
}

/* ===== History API (server Next.js, session-protected) ===== */

export async function fetchHistory(): Promise<HistoryItem[]> {
  const res = await fetch("/api/history", { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) throw new Error("unauthorized");
    throw new Error("Gagal memuat riwayat");
  }
  const data = (await res.json()) as { items: HistoryItem[] };
  return data.items.map((it) => ({
    ...it,
    review: (it.review ?? "") as ReviewStatus,
    createdAt: new Date(it.createdAt),
  }));
}

export async function saveHistory(input: {
  imageName: string;
  modelVersion: string;
  inferenceMs: number;
  detections: Detection[];
  thumbnail?: string;
  imageWidth?: number;
  imageHeight?: number;
  threshold?: number;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteHistoryItem(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function setHistoryReview(
  id: string,
  review: ReviewStatus,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/history/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ===== Export helpers ===== */

export function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(
  filename: string,
  result: PredictionResponse,
  imageName: string,
) {
  const rows = [
    ["image", "class_id", "class_name", "confidence", "x1", "y1", "x2", "y2"],
    ...result.detections.map((d) => [
      imageName,
      String(d.class_id),
      d.class_name,
      d.confidence.toFixed(4),
      d.bbox.x1.toFixed(1),
      d.bbox.y1.toFixed(1),
      d.bbox.x2.toFixed(1),
      d.bbox.y2.toFixed(1),
    ]),
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Buat thumbnail data-URL kecil (max ~480px) dari File/Blob. */
export async function makeThumbnail(
  blob: Blob,
  maxDim = 480,
): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.7);
}

/** Ukur dimensi asli gambar dari File (via createImageBitmap). */
export async function getImageSize(
  blob: Blob,
): Promise<{ w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const size = { w: bmp.width, h: bmp.height };
    bmp.close();
    return size;
  } catch {
    return null;
  }
}

/**
 * Siapkan file untuk diunggah: di atas ambang, encode ulang ke JPEG 0.85
 * TANPA mengubah dimensi — koordinat bbox backend tetap valid terhadap
 * gambar asli. BMP/PNG besar dari kamera/dataset bisa menyusut 5–20x,
 * sehingga upload tidak lagi jadi bottleneck. Gagal → file asli.
 */
const COMPRESS_ABOVE_BYTES = 2 * 1024 * 1024;

export async function prepareUploadImage(file: File): Promise<File> {
  if (file.size <= COMPRESS_ABOVE_BYTES) return file;
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return file;
    }
    // JPEG tak punya alfa — dasari putih agar transparan tak jadi hitam.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.85),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * Gambar label canvas yang ukurannya pas dengan teks: font dibatasi
 * 12–20px (proporsional lebar gambar), background diukur dari teks aktual,
 * posisi di atas box (atau di dalam bila mepet tepi) dan dijepit ke kanvas.
 */
function drawCanvasLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  color: string,
  bx: number,
  by: number,
  imgW: number,
  imgH: number,
) {
  const fs = Math.round(Math.min(20, Math.max(12, imgW * 0.011)));
  ctx.font = `600 ${fs}px -apple-system, "Segoe UI", sans-serif`;
  const padX = 6;
  const padY = 4;
  const bw = ctx.measureText(label).width + padX * 2;
  const bh = fs + padY * 2;
  const lx = Math.min(Math.max(0, bx), Math.max(0, imgW - bw));
  let ly = by - bh - 3;
  if (ly < 0) ly = Math.min(Math.max(0, by + 3), Math.max(0, imgH - bh));
  ctx.fillStyle = color;
  ctx.fillRect(lx, ly, bw, bh);
  ctx.fillStyle = "#1d1d1f";
  ctx.textBaseline = "top";
  ctx.fillText(label, lx + padX, ly + padY);
}

/**
 * Buat thumbnail dari File + gambar bbox deteksi di atasnya.
 * Koordinat deteksi dalam px gambar asli; naturalW/H = ukuran asli.
 */
export async function makeThumbnailWithBoxes(
  blob: Blob,
  detections: Detection[],
  naturalW: number,
  naturalH: number,
  maxDim = 640,
): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    return "";
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  const sx = w / naturalW;
  const sy = h / naturalH;
  ctx.lineWidth = Math.max(1.5, Math.round(w * 0.003));
  for (const d of detections) {
    const color = classColor(d.class_name);
    ctx.strokeStyle = color;
    const bx = d.bbox.x1 * sx;
    const by = d.bbox.y1 * sy;
    ctx.strokeRect(
      bx,
      by,
      (d.bbox.x2 - d.bbox.x1) * sx,
      (d.bbox.y2 - d.bbox.y1) * sy,
    );
    drawCanvasLabel(
      ctx,
      `${d.class_name} ${(d.confidence * 100).toFixed(0)}%`,
      color,
      bx,
      by,
      w,
      h,
    );
  }
  return canvas.toDataURL("image/jpeg", 0.72);
}

/** Cetak hasil deteksi sebagai laporan layak sidang (window.print → PDF). */
export function printReport(opts: {
  title: string;
  imageName: string;
  modelVersion: string;
  inferenceMs: number;
  imageUrl: string;
  detections: Detection[];
  threshold?: number;
  /** Label preset, mis. "Balance (45%)" — dari sensitivityLabelFor. */
  sensitivityLabel?: string;
  /** "live" = inferensi backend sungguhan; "demo" = rekaman presentasi. */
  source?: "live" | "demo";
  imageWidth?: number;
  imageHeight?: number;
  generatedAt?: Date;
}) {
  const {
    title,
    imageName,
    modelVersion,
    inferenceMs,
    imageUrl,
    detections,
    threshold,
    sensitivityLabel,
    source,
    imageWidth,
    imageHeight,
    generatedAt,
  } = opts;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const when = (generatedAt ?? new Date()).toLocaleString("id-ID");
  const rows = detections
    .map(
      (d, i) =>
        `<tr><td>${i + 1}</td><td><code>${esc(d.class_name)}</code></td><td>${(
          d.confidence * 100
        ).toFixed(1)}%</td><td>${Math.round(d.bbox.x1)}, ${Math.round(
          d.bbox.y1,
        )}, ${Math.round(d.bbox.x2)}, ${Math.round(d.bbox.y2)}</td></tr>`,
    )
    .join("");

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1d1d1f;padding:40px;max-width:800px;margin:0 auto}
  .kop{border-bottom:3px double #1d1d1f;padding-bottom:12px;margin-bottom:20px}
  .kop h1{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0}
  .kop p{font-size:12px;color:#6e6e73;margin:4px 0 0}
  h2{font-size:15px;margin:24px 0 8px}
  .meta{display:grid;grid-template-columns:150px 1fr;gap:4px 12px;font-size:13px;margin:0 0 8px}
  .meta dt{color:#6e6e73}
  .meta dd{margin:0;font-family:ui-monospace,monospace}
  img{max-width:100%;border:1px solid #e0e0e0;border-radius:12px;margin-top:8px}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  th,td{border-bottom:1px solid #e0e0e0;padding:7px 6px;text-align:left}
  th{font-size:11px;text-transform:uppercase;color:#6e6e73}
  code{font-size:12px}
  .badge{display:inline-block;background:#f5f5f7;border-radius:999px;padding:2px 10px;font-size:13px}
  .foot{margin-top:28px;padding-top:10px;border-top:1px solid #e0e0e0;font-size:11px;color:#6e6e73}
  @media print{.noprint{display:none}}
</style></head><body>
<div class="kop"><h1>Laporan Inspeksi Cacat PCB</h1><p>PCB Inspector — keperluan riset &amp; pendidikan</p></div>
<h2>Ringkasan</h2>
<dl class="meta">
<dt>Gambar</dt><dd>${esc(imageName)}${imageWidth && imageHeight ? ` (${imageWidth}×${imageHeight})` : ""}</dd>
<dt>Model</dt><dd>${esc(modelVersion)}</dd>
<dt>Waktu inferensi</dt><dd>${inferenceMs.toFixed(0)} ms</dd>
${threshold != null ? `<dt>Ambang</dt><dd>${sensitivityLabel ? esc(sensitivityLabel) + " · " : ""}${Math.round(threshold * 100)}%</dd>` : ""}
${source ? `<dt>Sumber</dt><dd>${source === "demo" ? "Demo (rekaman presentasi)" : "Live (inferensi backend)"}</dd>` : ""}
<dt>Jumlah deteksi</dt><dd>${detections.length}</dd>
<dt>Dicetak</dt><dd>${esc(when)}</dd>
</dl>
<h2>Gambar teranotasi</h2>
<img src="${imageUrl}" alt="PCB teranotasi"/>
<h2>Daftar temuan</h2>
${
  detections.length
    ? `<table><thead><tr><th>#</th><th>Kelas</th><th>Keyakinan</th><th>Koordinat (x1, y1, x2, y2)</th></tr></thead><tbody>${rows}</tbody></table>`
    : '<p><span class="badge">Tidak ada cacat terdeteksi</span></p>'
}
<div class="foot">Model hanya mengenali 6 kelas yang dilatih (${Object.keys(CLASS_META).join(", ")}).
Preset ambang terkalibrasi via sweep E16 (120 gambar val, ensemble 1280+1600; F1-maks mikro di 0.45).
Skor keyakinan bukan probabilitas terkalibrasi — hasil ini bukan pernyataan PCB aman/rusak secara menyeluruh.</div>
</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

/**
 * Unduh gambar teranotasi (bbox digambar permanen).
 * Dibatasi max 2048px sisi panjang: menjaga detail QC tapi aman dari
 * file raksasa / OOM canvas di ponsel. Jika gambar asli lebih kecil,
 * dipakai resolusi asli (tidak di-upscale).
 */
export async function downloadAnnotatedImage(
  blob: Blob,
  detections: Detection[],
  naturalW: number,
  naturalH: number,
  filename: string,
  maxDim = 2048,
): Promise<void> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    return;
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  const sx = w / naturalW;
  const sy = h / naturalH;
  ctx.lineWidth = Math.max(2, Math.round(w * 0.002));
  for (const d of detections) {
    const color = classColor(d.class_name);
    ctx.strokeStyle = color;
    const bx = d.bbox.x1 * sx;
    const by = d.bbox.y1 * sy;
    ctx.strokeRect(
      bx,
      by,
      (d.bbox.x2 - d.bbox.x1) * sx,
      (d.bbox.y2 - d.bbox.y1) * sy,
    );
    drawCanvasLabel(
      ctx,
      `${d.class_name} ${(d.confidence * 100).toFixed(0)}%`,
      color,
      bx,
      by,
      w,
      h,
    );
  }
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
