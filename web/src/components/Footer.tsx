import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-canvas-parchment text-ink-muted-80">
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-ink">PCB Inspector</p>
            <ul className="mt-3 space-y-2 text-[13px] leading-[2.2]">
              <li>
                <Link href="/" className="transition-opacity hover:opacity-70">
                  Beranda
                </Link>
              </li>
              <li>
                <Link
                  href="/#cara-kerja"
                  className="transition-opacity hover:opacity-70"
                >
                  Cara kerja
                </Link>
              </li>
              <li>
                <Link
                  href="/#kelas"
                  className="transition-opacity hover:opacity-70"
                >
                  Kelas cacat
                </Link>
              </li>
              <li>
                <Link
                  href="/inspect"
                  className="transition-opacity hover:opacity-70"
                >
                  Inspeksi
                </Link>
              </li>
              <li>
                <Link
                  href="/model"
                  className="transition-opacity hover:opacity-70"
                >
                  Model & metrik
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Akun</p>
            <ul className="mt-3 space-y-2 text-[13px] leading-[2.2]">
              <li>
                <Link
                  href="/login"
                  className="transition-opacity hover:opacity-70"
                >
                  Masuk
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="transition-opacity hover:opacity-70"
                >
                  Daftar
                </Link>
              </li>
              <li>
                <Link
                  href="/history"
                  className="transition-opacity hover:opacity-70"
                >
                  Riwayat inspeksi
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Tentang</p>
            <p className="mt-3 text-[13px] leading-relaxed">
              Proyek akademik deteksi cacat PCB berbasis YOLO. Hasil deteksi
              hanya mencakup 6 kelas yang dilatih — model tidak menyatakan PCB
              aman atau rusak secara menyeluruh.
            </p>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-hairline/60 pt-6 text-xs">
          <p>
            Copyright © {new Date().getFullYear()} PCB Inspector. Dibuat untuk
            keperluan riset & pendidikan.
          </p>
          <a
            href="/inspect?demo=1"
            title="Jalankan seluruh alur dengan hasil rekaman, tanpa backend"
            className="rounded-full border border-hairline px-2.5 py-1 transition-opacity hover:opacity-70"
          >
            Mode demo
          </a>
        </div>
      </div>
    </footer>
  );
}
