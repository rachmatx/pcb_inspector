/* Palet warna kelas cacat — shared antara viewer & history.
   Warna terang agar kontras di atas tile gelap. */
const CLASS_COLORS: Record<string, string> = {
  missing_hole: "#ff9f0a", // jingga
  mouse_bite: "#ffd60a", // kuning
  open_circuit: "#bf5af2", // ungu
  short: "#30d158", // hijau
  spur: "#64d2ff", // biru muda
  spurious_copper: "#ff375f", // merah muda
};

export const classColor = (name: string): string =>
  CLASS_COLORS[name] ?? "#a09d96";

/* Metadata Indonesia per kelas — dipakai Home, Inspect, History agar konsisten. */
export const CLASS_META: Record<string, { id: string; tip: string }> = {
  missing_hole: { id: "Lubang hilang / tidak terbentuk", tip: "Tipikal ≥ 0.50" },
  mouse_bite: { id: "Gigitan tikus pada tepi jalur", tip: "Tipikal ≥ 0.45" },
  open_circuit: { id: "Jalur terputus / tidak tersambung", tip: "Tipikal ≥ 0.50" },
  short: { id: "Hubungan pendek antar jalur", tip: "Tipikal ≥ 0.55" },
  spur: { id: "Percikan tembaga berlebih", tip: "Tipikal ≥ 0.40" },
  spurious_copper: { id: "Tembaga tak diinginkan", tip: "Tipikal ≥ 0.45" },
};

export const classDesc = (name: string): string =>
  CLASS_META[name]?.id ?? name;

export const hexToRgba = (hex: string, alpha: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
