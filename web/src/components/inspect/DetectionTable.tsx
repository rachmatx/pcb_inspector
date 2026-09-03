"use client";

import { useMemo, useState } from "react";
import type { Detection } from "@/lib/api";
import { classColor, classDesc } from "@/lib/colors";

type SortKey = "idx" | "class" | "conf";

export function DetectionTable({
  detections,
  highlightId,
  onHover,
  onFocusBox,
}: {
  detections: Detection[];
  highlightId: string | null;
  onHover: (id: string | null) => void;
  onFocusBox: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("conf");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [copied, setCopied] = useState<string | null>(null);

  const rows = useMemo(() => {
    const withIdx = detections.map((d, i) => ({ d, i, id: `det-${i}` }));
    const sorted = [...withIdx].sort((a, b) => {
      if (sortKey === "conf") return (a.d.confidence - b.d.confidence) * sortDir;
      if (sortKey === "class")
        return a.d.class_name.localeCompare(b.d.class_name) * sortDir;
      return (a.i - b.i) * sortDir;
    });
    return sorted;
  }, [detections, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((v) => (v === 1 ? -1 : 1));
    } else {
      setSortKey(k);
      setSortDir(k === "class" ? 1 : -1);
    }
  };

  const copyCoords = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      // clipboard tidak tersedia — abaikan, teks tetap terlihat
    }
  };

  const arrow = (k: SortKey) =>
    sortKey !== k ? "↕" : sortDir === 1 ? "↑" : "↓";

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-[15px]">
        <thead>
          <tr className="border-b border-hairline text-[12px] uppercase tracking-wide text-ink-muted-48">
            <th className="px-2 py-2 font-medium">
              <button
                type="button"
                onClick={() => toggleSort("idx")}
                className="transition-colors hover:text-ink"
                aria-label="Urutkan berdasarkan nomor"
              >
                # {arrow("idx")}
              </button>
            </th>
            <th className="px-2 py-2 font-medium">
              <button
                type="button"
                onClick={() => toggleSort("class")}
                className="transition-colors hover:text-ink"
                aria-label="Urutkan berdasarkan kelas"
              >
                Kelas {arrow("class")}
              </button>
            </th>
            <th className="px-2 py-2 font-medium">
              <button
                type="button"
                onClick={() => toggleSort("conf")}
                className="transition-colors hover:text-ink"
                aria-label="Urutkan berdasarkan keyakinan"
              >
                Keyakinan {arrow("conf")}
              </button>
            </th>
            <th className="hidden px-2 py-2 text-right font-medium md:table-cell">
              Koordinat
            </th>
            <th className="px-2 py-2 text-right font-medium">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline/60">
          {rows.map(({ d: det, i: idx, id }) => {
            const color = classColor(det.class_name);
            const coords = `[${det.bbox.x1.toFixed(0)}, ${det.bbox.y1.toFixed(0)}, ${det.bbox.x2.toFixed(0)}, ${det.bbox.y2.toFixed(0)}]`;
            const active = highlightId === id;
            return (
              <tr
                key={id}
                onMouseEnter={() => onHover(id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(id)}
                onBlur={() => onHover(null)}
                className={`transition-colors ${
                  active ? "bg-primary/5" : "hover:bg-canvas-parchment/50"
                }`}
              >
                <td className="px-2 py-2.5 font-mono text-[13px] text-ink-muted-48">
                  {idx + 1}
                </td>
                <td className="px-2 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <span>
                      <span className="block font-mono text-[14px] text-ink">
                        {det.class_name}
                      </span>
                      <span className="block text-[12px] text-ink-muted-48">
                        {classDesc(det.class_name)}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  <span className="font-mono text-[13px] text-ink-muted-80">
                    {(det.confidence * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="hidden px-2 py-2.5 text-right font-mono text-[13px] text-ink-muted-48 md:table-cell">
                  <button
                    type="button"
                    onClick={() => copyCoords(id, coords)}
                    title="Klik untuk salin koordinat"
                    className="rounded px-1 transition-colors hover:bg-canvas-parchment hover:text-ink"
                  >
                    {copied === id ? "Disalin!" : coords}
                  </button>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onFocusBox(id)}
                    className="rounded-full border border-hairline px-2.5 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-primary/5"
                  >
                    Fokus
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-ink-muted-48">
        Nomor pada gambar sama dengan kolom #. Arahkan kursor / fokus pada
        baris (atau box di gambar) untuk melihat label lengkap — atau zoom
        gambar ≥180% agar semua label tampil otomatis. Tombol Fokus melompat
        ke box sekali saja — zoom tidak dikunci.
      </p>
    </div>
  );
}
