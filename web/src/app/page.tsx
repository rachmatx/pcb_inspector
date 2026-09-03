import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { classColor, CLASS_META } from "@/lib/colors";

const DEFECTS = Object.entries(CLASS_META).map(([name, m]) => ({
  name,
  desc: m.id,
  tip: m.tip,
}));

const STEPS = [
  { n: "01", t: "Unggah", d: "Pilih gambar PCB — JPG, PNG, atau BMP, satu atau banyak sekaligus." },
  { n: "02", t: "Deteksi", d: "Model YOLO melokalisasi cacat permukaan + skor keyakinan." },
  { n: "03", t: "Tinjau", d: "Zoom, filter ambang, fokus per box, lalu ekspor JSON/CSV/gambar." },
];

/* Output asli best-e03v2-yolov8s pada foto ini (jalur default backend,
   tanpa override conf): 3× short, conf 74/71/69. Koordinat ternormalisasi
   [cx, cy, w, h] — bukan karangan. */
const HERO_BOXES = [
  { name: "short", conf: 74, cx: 0.4798, cy: 0.4915, w: 0.0294, h: 0.0335 },
  { name: "short", conf: 71, cx: 0.7522, cy: 0.6638, w: 0.0282, h: 0.0321 },
  { name: "short", conf: 69, cx: 0.3451, cy: 0.8593, w: 0.0288, h: 0.0421 },
];
const HERO_COLOR = "#30d158";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero — tile putih */}
        <section className="bg-canvas" aria-labelledby="hero-title">
          <div className="mx-auto max-w-[980px] px-4 py-16 text-center sm:px-6 sm:py-24">
            <h1
              id="hero-title"
              className="text-[40px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[56px]"
            >
              Inspeksi cacat PCB,
              <br />
              dari satu gambar.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[19px] leading-relaxed text-ink-muted-80 sm:text-[21px]">
              Unggah foto papan sirkuit dan dapatkan lokasi cacat permukaan
              secara otomatis — bounding box, kelas, dan skor keyakinan.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/inspect"
                className="pressable rounded-full bg-primary px-6 py-2.5 text-[17px] font-normal text-white transition-colors hover:bg-primary-focus"
              >
                Mulai inspeksi
              </Link>
              <Link
                href="/history"
                className="pressable rounded-full border border-primary px-6 py-2.5 text-[17px] font-normal text-primary transition-colors hover:bg-primary/5"
              >
                Lihat riwayat
              </Link>
            </div>
            {/* Foto uji asli + anotasi GT asli — defect benar-benar terlihat */}
            <figure className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-[18px] border border-hairline bg-surface-tile-1 text-left shadow-product">
              <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <span className="font-mono text-[12px] text-body-muted">
                  04_short_03.jpg · dataset uji
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[11px] text-body-on-dark">
                  short ×3
                </span>
              </div>
              <div className="relative">
                <Image
                  src="/hero-short.jpg"
                  alt="Foto PCB asli dengan tiga kotak anotasi short (hubungan pendek)"
                  width={1280}
                  height={1032}
                  sizes="(max-width: 768px) 100vw, 672px"
                  priority
                  className="block h-auto w-full"
                />
                {HERO_BOXES.map((b, i) => {
                  const nearTop = b.cy - b.h / 2 < 0.09;
                  return (
                    <div
                      key={i}
                      aria-hidden
                      className="absolute"
                      style={{
                        left: `${(b.cx - b.w / 2) * 100}%`,
                        top: `${(b.cy - b.h / 2) * 100}%`,
                        width: `${b.w * 100}%`,
                        height: `${b.h * 100}%`,
                        border: `2px solid ${HERO_COLOR}`,
                      }}
                    >
                      <span
                        className="absolute left-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-tight"
                        style={{
                          backgroundColor: HERO_COLOR,
                          color: "#1d1d1f",
                          top: nearTop ? 2 : -22,
                        }}
                      >
                        {i + 1} · {b.name} · {b.conf}%
                      </span>
                    </div>
                  );
                })}
              </div>
              <figcaption className="px-4 pb-4 pt-2 text-[12px] text-body-muted">
                Output asli model E03V2 · YOLOv8s pada foto ini — 3 hubungan
                pendek (short) dengan keyakinan 74/71/69%. Nomor sama dengan
                nomor baris di tabel halaman inspeksi.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Tile gelap — cara kerja */}
        <section
          id="cara-kerja"
          className="scroll-mt-16 bg-surface-tile-1"
          aria-labelledby="steps-title"
        >
          <div className="mx-auto max-w-[980px] px-4 py-16 text-center sm:px-6 sm:py-24">
            <h2
              id="steps-title"
              className="text-[32px] font-semibold leading-tight tracking-[-0.02em] text-body-on-dark sm:text-[40px]"
            >
              Tiga langkah sederhana.
            </h2>
            <div className="relative mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
              <div
                className="absolute left-[16%] right-[16%] top-3 hidden h-px bg-white/15 sm:block"
                aria-hidden
              />
              {STEPS.map((s) => (
                <div key={s.n} className="relative text-center">
                  <p className="relative mx-auto flex h-6 w-12 items-center justify-center rounded-full bg-surface-tile-2 text-[12px] font-semibold text-primary-on-dark">
                    {s.n}
                  </p>
                  <h3 className="mt-3 text-[21px] font-semibold text-body-on-dark">
                    {s.t}
                  </h3>
                  <p className="mx-auto mt-1 max-w-[26ch] text-[15px] leading-relaxed text-body-muted">
                    {s.d}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-10">
              <Link
                href="/inspect"
                className="pressable inline-block rounded-full bg-white px-5 py-2.5 text-[15px] font-medium text-black transition-opacity hover:opacity-85"
              >
                Coba sekarang
              </Link>
            </div>
          </div>
        </section>

        {/* Tile parchment — kelas cacat */}
        <section
          id="kelas"
          className="scroll-mt-16 bg-canvas-parchment"
          aria-labelledby="classes-title"
        >
          <div className="mx-auto max-w-[980px] px-4 py-16 sm:px-6 sm:py-24">
            <h2
              id="classes-title"
              className="text-center text-[32px] font-semibold tracking-[-0.02em] text-ink sm:text-[40px]"
            >
              Enam kelas cacat.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[17px] text-ink-muted-80">
              Model dilatih mengenali enam jenis cacat permukaan PCB yang umum.
              Warna selalu disertai label teks — tidak mengandalkan warna saja.
            </p>
            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DEFECTS.map((d) => {
                const c = classColor(d.name);
                return (
                  <div
                    key={d.name}
                    className="rounded-[18px] border border-hairline/60 bg-canvas p-5 text-left transition-shadow hover:shadow-product"
                  >
                    <p className="flex items-center gap-2 font-mono text-sm font-medium text-ink">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: c }}
                        aria-hidden
                      />
                      {d.name}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted-80">{d.desc}</p>
                    <p className="mt-2 inline-block rounded-full bg-canvas-parchment px-2 py-0.5 font-mono text-[11px] text-ink-muted-80">
                      {d.tip}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tile gelap bawah — CTA */}
        <section className="bg-surface-tile-1" aria-labelledby="cta-title">
          <div className="mx-auto max-w-[980px] px-4 py-16 text-center sm:px-6 sm:py-24">
            <h2
              id="cta-title"
              className="text-[32px] font-semibold tracking-[-0.02em] text-body-on-dark sm:text-[40px]"
            >
              Siap menguji PCB Anda?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-body-muted">
              Buka halaman inspeksi dan unggah gambar pertama Anda — gratis,
              tanpa instalasi. Hasil hanya mencakup 6 kelas yang dilatih.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/inspect"
                className="pressable inline-block rounded-full bg-primary px-6 py-3 text-[17px] text-white transition-colors hover:bg-primary-focus"
              >
                Mulai inspeksi
              </Link>
              <Link
                href="/#cara-kerja"
                className="pressable inline-block rounded-full border border-white/20 px-6 py-3 text-[17px] text-body-on-dark transition-colors hover:bg-white/10"
              >
                Cara kerja
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
