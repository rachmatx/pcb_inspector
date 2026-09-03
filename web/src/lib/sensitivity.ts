/** Preset ambang — satu-satunya sumber kebenaran untuk halaman inspeksi.
 * Terkalibrasi pada val set (120 gambar, E05, ensemble 1280+1600;
 * lihat docs/EXPERIMENTS.md E16). F1-maks mikro di 0.45; di bawah 0.30
 * presisi runtuh (banjir FP short/mouse_bite). */
export const DEFAULT_CONF = 0.45;

export const SENS_PRESETS = [
  {
    id: "recall",
    label: "High recall",
    value: 0.3,
    hint: "Recall 0.73 — menangkap temuan lemah untuk skrining awal. Presisi 0.63: false positive lebih banyak.",
  },
  {
    id: "balance",
    label: "Balance",
    value: 0.45,
    hint: "F1 terbaik (P 0.93, R 0.70) — rata-rata ambang kalibrasi backend per kelas.",
  },
  {
    id: "precision",
    label: "High precision",
    value: 0.6,
    hint: "Presisi 0.97 — hanya temuan yakin untuk verifikasi akhir. Temuan lemah bisa terlewat.",
  },
] as const;

/** Label manusiawi untuk ambang: "Balance (45%)" atau "Kustom (52%)". */
export function sensitivityLabelFor(value: number): string {
  const hit = SENS_PRESETS.find((p) => Math.abs(value - p.value) < 0.001);
  const pct = `${Math.round(value * 100)}%`;
  return hit ? `${hit.label} (${pct})` : `Kustom (${pct})`;
}
