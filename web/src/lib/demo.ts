"use client";

import type {
  HealthResponse,
  ModelInfo,
  PredictionResponse,
} from "./api";

const FLAG = "pcb-demo";
const URL = "/demo/canned.json";

type Canned = {
  conf: number;
  samples: Record<string, Record<string, PredictionResponse>>;
};

let cache: Canned | null = null;

/** Baca flag ?demo=1/0 (sekali saat mount) lalu persist di sessionStorage. */
export function initDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get("demo") === "1") {
    sessionStorage.setItem(FLAG, "1");
    return true;
  }
  if (q.get("demo") === "0") {
    sessionStorage.removeItem(FLAG);
    return false;
  }
  return sessionStorage.getItem(FLAG) === "1";
}

/** Keluar mode demo: bersihkan flag lalu muat ulang tanpa query. */
export function exitDemoMode(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(FLAG);
  // Muat ulang penuh disengaja: SSR harus render ulang tanpa badge demo
  // dan query ?demo=0 tidak boleh tertinggal di URL.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional full reload
  window.location.href = "/inspect";
}

export async function loadCanned(): Promise<Canned> {
  if (!cache) {
    const res = await fetch(URL, { cache: "force-cache" });
    if (!res.ok) throw new Error("Gagal memuat data demo.");
    cache = (await res.json()) as Canned;
  }
  return cache;
}

/** Daftar model turunan canned (id + display dari respons rekaman). */
export async function demoModels(): Promise<ModelInfo[]> {
  const c = await loadCanned();
  const first = Object.values(c.samples)[0];
  return Object.entries(first).map(([id, r]) => ({
    id,
    display: r.model_display ?? r.model_version ?? id,
  }));
}

export function demoHealth(models: ModelInfo[]): HealthResponse {
  return { status: "ok", model: models[0]?.display ?? "demo" };
}

/**
 * Prediksi canned untuk gambar contoh. Hanya mendukung file yang namanya
 * ada di rekaman; file lain melempar error yang jujur.
 */
export async function demoPredict(
  file: File,
  modelId?: string,
): Promise<PredictionResponse> {
  const c = await loadCanned();
  const entry = c.samples[file.name];
  if (!entry) {
    throw new Error(
      "Mode demo hanya mendukung gambar contoh. Tambahkan ?demo=0 ke URL untuk keluar.",
    );
  }
  const ids = Object.keys(entry);
  const pick = (modelId && entry[modelId] ? modelId : ids[0]) as string;
  // Jeda dramatis agar terasa seperti inferensi sungguhan.
  await new Promise((r) => setTimeout(r, 700));
  return JSON.parse(JSON.stringify(entry[pick])) as PredictionResponse;
}
