"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeaderSimple } from "./SiteHeaderSimple";
import { Footer } from "./Footer";
import { Toaster } from "./Toaster";
import { CheckIcon } from "./icons";

const BENEFITS = [
  "10 inspeksi terakhir tersimpan otomatis",
  "Tandai TP / FP / Miss untuk analisis error",
  "Ekspor JSON, CSV, dan gambar teranotasi",
];

/** Rangka split-panel untuk login & register: panel gelap + form. */
export function AuthLayout({
  title,
  subtitle,
  switchText,
  switchHref,
  switchLabel,
  children,
}: {
  title: string;
  subtitle: string;
  switchText: string;
  switchHref: string;
  switchLabel: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeaderSimple />
      <Toaster />
      <main className="flex min-h-[calc(100vh-44px)] items-center justify-center bg-canvas-parchment px-4 py-12">
        <div className="animate-fade-up grid w-full max-w-3xl overflow-hidden rounded-[24px] border border-hairline/60 bg-canvas shadow-product sm:grid-cols-[1fr_1.15fr]">
          {/* Panel gelap — value proposition */}
          <div className="hidden flex-col justify-between bg-surface-tile-1 p-8 text-body-on-dark sm:flex">
            <div>
              <p className="text-sm font-semibold tracking-tight">
                PCB Inspector
              </p>
              <h2 className="mt-8 text-[28px] font-semibold leading-[1.2] tracking-[-0.02em]">
                Riwayat inspeksi, tersimpan rapi.
              </h2>
              <ul className="mt-6 space-y-3">
                {BENEFITS.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2.5 text-[14px] leading-snug text-body-muted"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-400">
                      <CheckIcon width={12} height={12} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[12px] text-body-muted/70">
              Gratis · tanpa instalasi · untuk riset & pendidikan
            </p>
          </div>

          {/* Panel form */}
          <div className="p-6 sm:p-8">
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">
              {title}
            </h1>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-muted-80">
              {subtitle}
            </p>
            <div className="mt-6">{children}</div>
            <p className="mt-6 text-center text-[14px] text-ink-muted-80">
              {switchText}{" "}
              <Link
                href={switchHref}
                className="font-medium text-primary transition-colors hover:text-primary-focus"
              >
                {switchLabel}
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
