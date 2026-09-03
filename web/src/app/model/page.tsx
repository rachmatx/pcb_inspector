import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CLASS_META, classColor } from "@/lib/colors";

export const metadata = { title: "Model — PCB Inspector" };

const HEADLINE = [
  { k: "mAP50", v: "0.956" },
  { k: "Precision", v: "0.976" },
  { k: "Recall", v: "0.883" },
  { k: "F1", v: "0.927" },
];

/** Hasil sweep E16 @ambang 0.45 (jalur override, ensemble, 120 val). */
const PER_CLASS = [
  { name: "missing_hole", f1: "0.984", best: "0.20" },
  { name: "mouse_bite", f1: "0.690", best: "0.30" },
  { name: "open_circuit", f1: "0.889", best: "0.60" },
  { name: "short", f1: "0.791", best: "0.50" },
  { name: "spur", f1: "0.286", best: "0.20" },
  { name: "spurious_copper", f1: "0.870", best: "0.40" },
];

const SWEEP = [
  ["0.20", "0.419", "0.791", "0.548"],
  ["0.25", "0.496", "0.757", "0.600"],
  ["0.30", "0.630", "0.732", "0.677"],
  ["0.35", "0.640", "0.721", "0.678"],
  ["0.40", "0.913", "0.704", "0.795"],
  ["0.45", "0.929", "0.696", "0.796"],
  ["0.50", "0.946", "0.682", "0.792"],
  ["0.55", "0.952", "0.662", "0.781"],
  ["0.60", "0.967", "0.654", "0.780"],
  ["0.65", "0.978", "0.623", "0.761"],
  ["0.70", "0.981", "0.567", "0.719"],
];

const PRESETS = [
  { n: "High recall", v: "0.30", d: "Recall 0.73 — skrining awal" },
  { n: "Balance", v: "0.45", d: "F1 terbaik (P 0.93, R 0.70)" },
  { n: "High precision", v: "0.60", d: "Presisi 0.97 — verifikasi akhir" },
];

export default function ModelPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[980px] flex-1 px-4 py-10 sm:px-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas-parchment px-3.5 py-1 text-[13px] font-medium text-ink-muted-80">
          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
          Model produksi · E05V1 · YOLOv8s @1280
        </p>
        <h1 className="mt-4 text-[34px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[44px]">
          Model Card
        </h1>
        <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-ink-muted-80">
          Bukti riset di balik aplikasi ini: metrik validasi, kalibrasi
          ambang, pipeline inferensi, dan keterbatasan yang diketahui.
        </p>

        {/* Metrik utama */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {HEADLINE.map((m) => (
            <div
              key={m.k}
              className="rounded-[18px] border border-hairline bg-canvas p-4 text-center"
            >
              <p className="text-[12px] uppercase tracking-wide text-ink-muted-48">
                {m.k}
              </p>
              <p className="mt-1 text-[30px] font-semibold tracking-tight text-ink">
                {m.v}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-ink-muted-48">
          Validasi Ultralytics (conf default), YOLOv8s @1280. mAP50-95: 0.529.
          Dataset ±693 gambar, 6 kelas, split berbasis grup PCB (anti-leakage).
        </p>

        {/* Per kelas */}
        <h2 className="mt-10 text-[24px] font-semibold tracking-tight text-ink">
          Performa per kelas
        </h2>
        <p className="mt-1 text-[14px] text-ink-muted-80">
          F1 pada ambang Balance 0.45 (jalur override, ensemble 1280+1600, 120
          gambar val). Kolom kanan = ambang F1-maks tiap kelas.
        </p>
        <div className="mt-4 overflow-x-auto rounded-[18px] border border-hairline bg-canvas">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-hairline text-[12px] uppercase tracking-wide text-ink-muted-48">
                <th className="px-4 py-2.5 font-medium">Kelas</th>
                <th className="px-4 py-2.5 font-medium">Deskripsi</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  F1 @0.45
                </th>
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
                  F1-maks @
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline/60">
              {PER_CLASS.map((c) => (
                <tr key={c.name} className="hover:bg-canvas-parchment/50">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2 font-mono text-[13px] text-ink">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: classColor(c.name) }}
                        aria-hidden
                      />
                      {c.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted-80">
                    {CLASS_META[c.name]?.id ?? ""}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono font-medium ${
                      Number(c.f1) < 0.5 ? "text-amber-700" : "text-ink"
                    }`}
                  >
                    {c.f1}
                  </td>
                  <td className="hidden px-4 py-2.5 text-right font-mono text-ink-muted-48 sm:table-cell">
                    {c.best}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Kalibrasi */}
        <h2 className="mt-10 text-[24px] font-semibold tracking-tight text-ink">
          Kalibrasi ambang (E16)
        </h2>
        <p className="mt-1 text-[14px] text-ink-muted-80">
          Sweep 0.20–0.70 → F1-maks mikro di <strong>0.45</strong>. Preset di
          halaman inspeksi memakai angka ini.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <span
              key={p.n}
              className="rounded-full bg-canvas-parchment px-3.5 py-1.5 text-[13px] font-medium text-ink"
              title={p.d}
            >
              {p.n} · {p.v}
            </span>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto rounded-[18px] border border-hairline bg-canvas">
          <table className="w-full text-left font-mono text-[13px]">
            <thead>
              <tr className="border-b border-hairline text-[12px] uppercase tracking-wide text-ink-muted-48">
                <th className="px-4 py-2.5 font-medium">Ambang</th>
                <th className="px-4 py-2.5 text-right font-medium">Precision</th>
                <th className="px-4 py-2.5 text-right font-medium">Recall</th>
                <th className="px-4 py-2.5 text-right font-medium">F1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline/60">
              {SWEEP.map(([t, p, r, f]) => (
                <tr
                  key={t}
                  className={
                    t === "0.45"
                      ? "bg-primary/5 font-medium"
                      : "hover:bg-canvas-parchment/50"
                  }
                >
                  <td className="px-4 py-2">{t}</td>
                  <td className="px-4 py-2 text-right text-ink-muted-80">{p}</td>
                  <td className="px-4 py-2 text-right text-ink-muted-80">{r}</td>
                  <td className="px-4 py-2 text-right text-ink">{f}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pipeline + batas */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[18px] border border-hairline bg-canvas p-5">
            <h3 className="text-[17px] font-semibold text-ink">
              Pipeline inferensi
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink-muted-80">
              <li>Ensemble 2 resolusi (1280 + 1600), NMS-fusion IoU 0.50.</li>
              <li>Slider mengirim satu conf (menggantikan ambang per kelas).</li>
              <li>Maksimal 20 deteksi per resolusi.</li>
              <li>Gate gambar-non-PCB: fraksi hijau, batas 0.40.</li>
            </ul>
          </div>
          <div className="rounded-[18px] border border-amber-500/40 bg-amber-500/5 p-5">
            <h3 className="text-[17px] font-semibold text-ink">
              Keterbatasan
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink-muted-80">
              <li>
                <span className="font-mono">spur</span> terlemah (F1 0.29) —
                butuh retraining.
              </li>
              <li>Skor keyakinan bukan probabilitas terkalibrasi.</li>
              <li>Foto alam berdaun lolos gate; PCB hitam/putih bisa kena flag.</li>
              <li>Hanya 6 kelas — bukan pernyataan PCB aman/rusak.</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/inspect"
            className="pressable rounded-full bg-primary px-6 py-2.5 text-[15px] text-white transition-colors hover:bg-primary-focus"
          >
            Coba modelnya
          </Link>
          <Link
            href="/history"
            className="pressable rounded-full border border-primary px-6 py-2.5 text-[15px] text-primary transition-colors hover:bg-primary/5"
          >
            Lihat riwayat
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
