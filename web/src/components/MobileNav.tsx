"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/inspect", label: "Inspeksi" },
  { href: "/history", label: "Riwayat" },
  { href: "/model", label: "Model" },
];

function linkCls(href: string, pathname: string) {
  const active =
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  return active
    ? "text-body-on-dark"
    : "text-body-on-dark/70 hover:text-body-on-dark";
}

/** Navigasi mobile (hamburger) + link desktop — dipakai kedua header agar konsisten. */
export function NavLinks({
  orientation = "desktop",
  onNavigate,
}: {
  orientation?: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  if (orientation === "desktop") {
    return (
      <nav
        aria-label="Navigasi utama"
        className="hidden items-center gap-5 text-xs sm:flex"
      >
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={
              (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href))
                ? "page"
                : undefined
            }
            className={`transition-opacity hover:opacity-70 ${linkCls(l.href, pathname)}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Navigasi utama" className="grid gap-1 p-2">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={onNavigate}
          className="rounded-[11px] px-3 py-2.5 text-[15px] text-ink transition-colors hover:bg-canvas-parchment"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Tutup menu" : "Buka menu"}
        className="flex h-9 w-9 items-center justify-center rounded-full text-body-on-dark transition-colors hover:bg-white/10"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <line x1="3" y1="7" x2="21" y2="7" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="17" x2="21" y2="17" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute inset-x-3 top-12 z-50 overflow-hidden rounded-[18px] border border-hairline bg-canvas text-ink shadow-product">
          <NavLinks orientation="mobile" onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
