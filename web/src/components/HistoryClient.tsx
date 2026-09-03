"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertIcon,
  CheckIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { Toaster, notify } from "@/components/Toaster";
import {
  deleteHistoryItem,
  fetchHistory,
  setHistoryReview,
  type HistoryItem,
  type ReviewStatus,
} from "@/lib/api";
import { classColor, classDesc } from "@/lib/colors";

const REVIEW_LABEL: Record<ReviewStatus, { text: string; cls: string }> = {
  "": { text: "Belum", cls: "bg-canvas-parchment text-ink-muted-80" },
  tp: { text: "TP", cls: "bg-green-500/10 text-green-700" },
  fp: { text: "FP", cls: "bg-red-500/10 text-red-600" },
  miss: { text: "Miss", cls: "bg-amber-500/10 text-amber-700" },
};

function ReviewButtons({
  value,
  onChange,
}: {
  value: ReviewStatus;
  onChange: (v: ReviewStatus) => void;
}) {
  const opts: { v: ReviewStatus; label: string }[] = [
    { v: "", label: "Belum" },
    { v: "tp", label: "TP" },
    { v: "fp", label: "FP" },
    { v: "miss", label: "Miss" },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`pressable rounded-full px-2.5 py-0.5 text-[12px] font-medium transition-colors ${
            value === o.v
              ? REVIEW_LABEL[o.v].cls
              : "bg-canvas-parchment text-ink-muted-48 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Modal "lihat lagi": thumbnail + daftar deteksi. */
function DetailModal({
  item,
  items,
  onClose,
  onPrev,
  onNext,
  onReview,
}: {
  item: HistoryItem;
  items: HistoryItem[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReview: (id: string, v: ReviewStatus) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const idx = items.findIndex((x) => x.id === item.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label={`Detail ${item.imageName}`}
    >
      <div
        className="animate-fade-up max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[18px] bg-canvas p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-mono text-[16px] font-medium text-ink">
              {item.imageName}
            </p>
            <p className="text-[13px] text-ink-muted-48">
              {item.createdAt.toLocaleString("id-ID")} · {item.modelVersion} ·{" "}
              {item.inferenceMs.toFixed(0)} ms · {idx + 1}/{items.length}
              {item.imageWidth != null && item.imageHeight != null && (
                <> · {item.imageWidth}×{item.imageHeight}</>
              )}
              {item.threshold != null && (
                <> · ambang {Math.round(item.threshold * 100)}%</>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              aria-label="Sebelumnya"
              className="pressable rounded-full px-2.5 py-1.5 text-[13px] text-ink-muted-48 transition-colors hover:bg-canvas-parchment hover:text-ink"
            >
              ←
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Berikutnya"
              className="pressable rounded-full px-2.5 py-1.5 text-[13px] text-ink-muted-48 transition-colors hover:bg-canvas-parchment hover:text-ink"
            >
              →
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              autoFocus
              className="pressable rounded-full p-2 text-ink-muted-48 transition-colors hover:bg-canvas-parchment hover:text-ink"
            >
              <XIcon width={18} height={18} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex justify-center bg-canvas-parchment/50">
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail}
              alt={item.imageName}
              className="max-h-[60vh] w-auto max-w-full rounded-[11px] border border-hairline object-contain"
            />
          ) : (
            <p className="rounded-[11px] bg-canvas-parchment p-4 text-ink-muted-48">
              (Thumbnail tidak tersedia — gambar asli tidak disimpan)
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-hairline pt-3">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted-48">
            Review
          </span>
          <ReviewButtons
            value={item.review}
            onChange={(v) => onReview(item.id, v)}
          />
        </div>

        <div className="mt-4">
          {item.detections.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[14px] text-green-700">
              <CheckIcon width={15} height={15} />
              Tidak ada cacat terdeteksi
            </p>
          ) : (
            <ul className="space-y-1.5">
              {item.detections.map((d, i) => {
                const c = classColor(d.class_name);
                return (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-[14px] text-ink"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: c }}
                      aria-hidden
                    />
                    <span className="font-mono" title={classDesc(d.class_name)}>
                      {d.class_name}
                    </span>
                    <span className="font-mono text-ink-muted-48">
                      {(d.confidence * 100).toFixed(1)}%
                    </span>
                    <span className="ml-auto hidden font-mono text-[12px] text-ink-muted-48 sm:inline">
                      [{Math.round(d.bbox.x1)}, {Math.round(d.bbox.y1)},{" "}
                      {Math.round(d.bbox.x2)}, {Math.round(d.bbox.y2)}]
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function HistoryClient() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewStatus | "all">("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [sort, setSort] = useState<"new" | "name" | "most">("new");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchHistory()
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "gagal";
        if (msg === "unauthorized") {
          router.push("/login?next=/history");
          return;
        }
        if (active) setError("Gagal memuat riwayat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setConfirmId(null);
    const ok = await deleteHistoryItem(id);
    setDeleting(null);
    if (ok) {
      setItems((prev) => prev?.filter((i) => i.id !== id) ?? null);
      notify("success", "Riwayat dihapus.");
    } else {
      notify("error", "Gagal menghapus riwayat.");
    }
  };

  const handleReview = async (id: string, v: ReviewStatus) => {
    const prev = items?.find((i) => i.id === id)?.review ?? "";
    setItems((prevItems) =>
      prevItems?.map((i) => (i.id === id ? { ...i, review: v } : i)) ?? null,
    );
    const ok = await setHistoryReview(id, v);
    if (!ok) {
      setItems((prevItems) =>
        prevItems?.map((i) => (i.id === id ? { ...i, review: prev } : i)) ??
        null,
      );
      notify("error", "Gagal menyimpan review.");
    }
  };

  const stats = useMemo(() => {
    if (!items || items.length === 0) return null;
    const classCount: Record<string, number> = {};
    let totalDet = 0;
    let tp = 0;
    let fp = 0;
    let miss = 0;
    items.forEach((i) => {
      totalDet += i.detections.length;
      if (i.review === "tp") tp++;
      if (i.review === "fp") fp++;
      if (i.review === "miss") miss++;
      i.detections.forEach((d) => {
        classCount[d.class_name] = (classCount[d.class_name] ?? 0) + 1;
      });
    });
    return {
      count: items.length,
      totalDet,
      classCount,
      reviewed: { tp, fp, miss },
    };
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    let out = items.filter((i) => {
      if (reviewFilter !== "all" && i.review !== reviewFilter) return false;
      if (
        classFilter !== "all" &&
        !i.detections.some((d) => d.class_name === classFilter)
      )
        return false;
      if (!q) return true;
      return (
        i.imageName.toLowerCase().includes(q) ||
        i.detections.some((d) => d.class_name.toLowerCase().includes(q))
      );
    });
    out = [...out].sort((a, b) => {
      if (sort === "name") return a.imageName.localeCompare(b.imageName);
      if (sort === "most") return b.detections.length - a.detections.length;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return out;
  }, [items, query, reviewFilter, classFilter, sort]);

  const allClasses = useMemo(() => {
    const s = new Set<string>();
    items?.forEach((i) => i.detections.forEach((d) => s.add(d.class_name)));
    return Array.from(s).sort();
  }, [items]);

  const detail = detailId ? (filtered.find((i) => i.id === detailId) ?? items?.find((i) => i.id === detailId) ?? null) : null;

  const stepDetail = (dir: 1 | -1) => {
    if (!detail || filtered.length === 0) return;
    const idx = filtered.findIndex((x) => x.id === detail.id);
    const next = filtered[(idx + dir + filtered.length) % filtered.length];
    if (next) setDetailId(next.id);
  };

  const relative = (d: Date) => {
    // eslint-disable-next-line react-hooks/purity -- waktu relatif display-only
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "baru saja";
    if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
    if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
    return d.toLocaleDateString("id-ID");
  };

  return (
    <div>
      <Toaster />
      {/* Statistik agregat */}
      {stats && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[18px] border border-hairline bg-canvas p-4">
            <p className="text-[12px] uppercase tracking-wide text-ink-muted-48">
              Inspeksi
            </p>
            <p className="mt-1 text-[28px] font-semibold tracking-tight text-ink">
              {stats.count}
            </p>
            <p className="text-[13px] text-ink-muted-48">
              {stats.totalDet} total deteksi
            </p>
          </div>
          <div className="rounded-[18px] border border-hairline bg-canvas p-4">
            <p className="text-[12px] uppercase tracking-wide text-ink-muted-48">
              Distribusi kelas
            </p>
            <div className="mt-2 space-y-1.5">
              {Object.entries(stats.classCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([name, n]) => {
                  const pct =
                    stats.totalDet > 0
                      ? Math.round((n / stats.totalDet) * 100)
                      : 0;
                  const c = classColor(name);
                  return (
                    <div key={name} title={`${name} ×${n} (${pct}%)`}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-mono font-medium text-ink">
                          {name}
                        </span>
                        <span className="font-mono text-ink-muted-48">
                          ×{n}
                        </span>
                      </div>
                      <div
                        className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-canvas-parchment"
                        role="img"
                        aria-label={`${name}: ${n} dari ${stats.totalDet}`}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: c }}
                        />
                      </div>
                    </div>
                  );
                })}
              {Object.keys(stats.classCount).length === 0 && (
                <p className="text-[13px] text-ink-muted-48">Belum ada deteksi.</p>
              )}
            </div>
          </div>
          <div className="rounded-[18px] border border-hairline bg-canvas p-4">
            <p className="text-[12px] uppercase tracking-wide text-ink-muted-48">
              Error analysis
            </p>
            <p className="mt-1 text-[15px] font-medium text-ink">
              <span className="text-green-700">TP {stats.reviewed.tp}</span>
              {" · "}
              <span className="text-red-600">FP {stats.reviewed.fp}</span>
              {" · "}
              <span className="text-amber-700">Miss {stats.reviewed.miss}</span>
            </p>
            <p className="text-[12px] text-ink-muted-48">
              {stats.reviewed.tp + stats.reviewed.fp + stats.reviewed.miss}/
              {stats.count} sudah direview — tandai tiap kartu.
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama gambar atau kelas…"
            aria-label="Cari riwayat"
            className="w-full max-w-xs rounded-full border border-hairline bg-canvas px-4 py-2 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-muted-48 focus:border-primary-focus"
          />
          <button
            type="button"
            onClick={() => router.push("/inspect")}
            className="pressable rounded-full bg-primary px-5 py-2 text-[14px] text-white transition-colors hover:bg-primary-focus"
          >
            + Inspeksi baru
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label="Filter review"
          >
            {(
              [
                ["all", "Semua"],
                ["", "Belum"],
                ["tp", "TP"],
                ["fp", "FP"],
                ["miss", "Miss"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setReviewFilter(v)}
                aria-pressed={reviewFilter === v}
                className={`pressable rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                  reviewFilter === v
                    ? "bg-ink text-white"
                    : "bg-canvas-parchment text-ink-muted-48 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label="Filter kelas"
            className="rounded-full border border-hairline bg-canvas px-3 py-1 text-[12px] text-ink outline-none focus:border-primary-focus"
          >
            <option value="all">Semua kelas</option>
            {allClasses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Urutkan"
            className="rounded-full border border-hairline bg-canvas px-3 py-1 text-[12px] text-ink outline-none focus:border-primary-focus"
          >
            <option value="new">Terbaru</option>
            <option value="name">Nama A–Z</option>
            <option value="most">Deteksi terbanyak</option>
          </select>
          {(reviewFilter !== "all" || classFilter !== "all" || query.trim()) && (
            <button
              type="button"
              onClick={() => {
                setReviewFilter("all");
                setClassFilter("all");
                setQuery("");
              }}
              className="text-[12px] font-medium text-primary hover:underline"
            >
              Reset filter
            </button>
          )}
          <span className="ml-auto text-[12px] text-ink-muted-48" aria-live="polite">
            {filtered.length} hasil
          </span>
        </div>
      </div>

      {loading && (
        <div className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Memuat riwayat">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[18px] border border-hairline bg-canvas"
            >
              <div className="skeleton aspect-[16/9] w-full" />
              <div className="space-y-2 p-4">
                <div className="skeleton h-4 w-2/3 rounded-full" />
                <div className="skeleton h-3 w-1/3 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="mt-6 flex items-center gap-2 rounded-[11px] bg-red-500/5 px-4 py-3 text-[14px] text-red-600">
          <AlertIcon width={16} height={16} />
          {error}
        </div>
      )}

      {!loading && !error && items && items.length === 0 && (
        <div className="mt-10 rounded-[18px] border border-dashed border-hairline bg-canvas p-12 text-center">
          <p className="text-[17px] font-medium text-ink">Belum ada riwayat</p>
          <p className="mt-1 text-[14px] text-ink-muted-48">
            Jalankan inspeksi pertamamu — hasilnya akan tersimpan di sini
            (maksimal 10 terakhir).
          </p>
          <Link
            href="/inspect"
            className="pressable mt-5 inline-block rounded-full bg-primary px-5 py-2 text-[14px] text-white transition-colors hover:bg-primary-focus"
          >
            Mulai inspeksi
          </Link>
        </div>
      )}

      {!loading && !error && items && items.length > 0 && filtered.length === 0 && (
        <div className="mt-10 text-center text-[14px] text-ink-muted-48">
          Tidak ada hasil yang cocok dengan pencarian.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-[18px] border border-hairline bg-canvas transition-shadow hover:shadow-product"
            >
              {/* Thumbnail — contain agar bbox tidak terpotong */}
              <button
                type="button"
                onClick={() => setDetailId(item.id)}
                aria-label={`Lihat detail ${item.imageName}`}
                className="block w-full bg-black transition-opacity hover:opacity-95"
              >
                {item.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnail}
                    alt={item.imageName}
                    loading="lazy"
                    className="aspect-[16/9] w-full object-contain"
                  />
                ) : (
                  <div className="flex aspect-[16/9] w-full items-center justify-center text-[13px] text-body-muted">
                    Lihat detail →
                  </div>
                )}
              </button>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailId(item.id)}
                    className="min-w-0 text-left"
                  >
                    <p className="truncate font-mono text-[14px] font-medium text-ink hover:underline">
                      {item.imageName}
                    </p>
                  </button>
                  {confirmId === item.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleting === item.id}
                        className="pressable rounded-full bg-red-600 px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50"
                      >
                        {deleting === item.id ? "Menghapus…" : "Ya, hapus"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-full px-2 py-1 text-[12px] text-ink-muted-48 hover:text-ink"
                      >
                        Batal
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(item.id)}
                      aria-label={`Hapus ${item.imageName}`}
                      className="pressable shrink-0 rounded-full p-1.5 text-ink-muted-48 transition-colors hover:bg-red-500/10 hover:text-red-600"
                    >
                      <TrashIcon width={14} height={14} />
                    </button>
                  )}
                </div>
                <p
                  className="mt-0.5 text-[12px] text-ink-muted-48"
                  title={item.createdAt.toLocaleString("id-ID")}
                >
                  {relative(item.createdAt)} · {item.modelVersion} ·{" "}
                  {item.detections.length} deteksi
                  {item.imageWidth != null && item.imageHeight != null && (
                    <>
                      {" "}· {item.imageWidth}×{item.imageHeight}
                    </>
                  )}
                  {item.threshold != null && (
                    <> · {Math.round(item.threshold * 100)}%</>
                  )}
                </p>

                {/* Chips deteksi */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.detections.length > 0 ? (
                    item.detections.slice(0, 4).map((d, i) => {
                      const c = classColor(d.class_name);
                      return (
                        <span
                          key={i}
                          title={classDesc(d.class_name)}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium text-ink"
                          style={{ backgroundColor: `${c}33` }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: c }}
                            aria-hidden
                          />
                          {d.class_name} · {(d.confidence * 100).toFixed(0)}%
                        </span>
                      );
                    })
                  ) : (
                    <span className="flex items-center gap-1 text-[12px] text-green-700">
                      <CheckIcon width={13} height={13} />
                      Bersih
                    </span>
                  )}
                  {item.detections.length > 4 && (
                    <button
                      type="button"
                      onClick={() => setDetailId(item.id)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      +{item.detections.length - 4} lainnya
                    </button>
                  )}
                </div>

                {/* Error analysis */}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline pt-3">
                  <span className="text-[11px] uppercase tracking-wide text-ink-muted-48">
                    Review
                  </span>
                  <ReviewButtons
                    value={item.review}
                    onChange={(v) => handleReview(item.id, v)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <DetailModal
          item={detail}
          items={filtered.length > 0 ? filtered : (items ?? [])}
          onClose={() => setDetailId(null)}
          onPrev={() => stepDetail(-1)}
          onNext={() => stepDetail(1)}
          onReview={handleReview}
        />
      )}
    </div>
  );
}
