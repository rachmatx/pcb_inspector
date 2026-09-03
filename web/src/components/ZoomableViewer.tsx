"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExpandIcon,
  FitIcon,
  MinusIcon,
  PlusIcon,
  RotateCwIcon,
} from "./icons";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 12;
const ZOOM_STEP = 1.4;
/** Di atas skala ini semua label tampil otomatis (box sudah besar & renggang). */
const LABEL_ZOOM_THRESHOLD = 1.8;

export type OverlayBox = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  label: string;
};

type Props = {
  src: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
  /** Deteksi dalam koordinat natural; border & label dirender tajam di layar. */
  boxes?: OverlayBox[];
  /** Id box yang sedang disorot dari tabel (hover/fokus). */
  highlightId?: string | null;
  /** Permintaan fokus dari tabel: {id, n} — n naik tiap klik agar efek jalan ulang. */
  focusRequest?: { id: string; n: number } | null;
  onBoxClick?: (id: string) => void;
  onBoxHover?: (id: string | null) => void;
  children?: React.ReactNode;
};

export function ZoomableViewer({
  src,
  alt,
  naturalWidth,
  naturalHeight,
  boxes = [],
  highlightId = null,
  focusRequest = null,
  onBoxClick,
  onBoxHover,
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [userScale, setUserScale] = useState(1);
  // Posisi sudut kiri-atas konten gambar dalam container (px).
  // Model origin 0,0: transform = translate(pos.x, pos.y) scale(s).
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [userControlled, setUserControlled] = useState(false);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  // Skala efektif terakhir — dipakai saat transisi mode fit -> drag.
  const scaleRef = useRef(1);

  // Skala "fit": muatkan seluruh gambar dalam container.
  const fitScale = useMemo(() => {
    const pad = 40;
    const cw = containerSize.w - pad;
    const ch = containerSize.h - pad;
    if (cw <= 0 || ch <= 0 || naturalWidth <= 0) return 1;
    return Math.min(cw / naturalWidth, ch / naturalHeight);
  }, [containerSize, naturalWidth, naturalHeight]);

  const scale = userControlled ? userScale : fitScale;

  // Posisi tampil: terpusat otomatis selama belum ada interaksi user
  // (tanpa effect — murni turunan dari ukuran container & gambar).
  const autoPos = useMemo(
    () => ({
      x: (containerSize.w - naturalWidth * scale) / 2,
      y: (containerSize.h - naturalHeight * scale) / 2,
    }),
    [containerSize, naturalWidth, naturalHeight, scale],
  );
  const viewPos = userControlled ? pos : autoPos;
  const viewPosRef = useRef(viewPos);

  // Sinkronkan scaleRef dengan skala yang sedang tampil.
  useEffect(() => {
    scaleRef.current = scale;
    viewPosRef.current = viewPos;
  }, [scale, viewPos]);

  const clamp = useCallback(
    (s: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s)),
    [],
  );

  const zoomBy = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const el = containerRef.current;
      const rect = el?.getBoundingClientRect();
      // Basis zoom = skala yang sedang tampil (fitScale jika masih mode fit).
      const base = userControlled ? userScale : fitScale;
      const next = clamp(base * factor);
      setUserScale(next);
      setUserControlled(true);

      if (rect) {
        // Titik acuan zoom: koordinat kursor relatif container (default tengah).
        const cx = clientX !== undefined ? clientX - rect.left : rect.width / 2;
        const cy = clientY !== undefined ? clientY - rect.top : rect.height / 2;
        const ratio = next / (base || 1);

        // Origin 0,0: posisi konten = pos tampil. Titik gambar di bawah kursor
        // berada pada (cx - pos). Agar tetap di bawah kursor setelah zoom:
        //   (cx - pos_new) = (cx - pos_old) * ratio
        //   pos_new = cx - (cx - pos_old) * ratio
        const cur = viewPosRef.current;
        setPos({
          x: cx - (cx - cur.x) * ratio,
          y: cy - (cy - cur.y) * ratio,
        });
      }
    },
    [clamp, fitScale, userControlled, userScale],
  );

  // Ukuran container aktual lewat ResizeObserver.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setContainerSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom via native non-passive listener (React wheel bersifat passive
  // sehingga preventDefault gagal & scroll halaman ikut terjadi).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomBy(factor, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Jangan mulai pan bila interaksi dimulai pada tombol (mis. toolbar zoom).
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;
      if (e.button !== 0) return;
      setIsPanning(true);
      const cur = viewPosRef.current;
      panStart.current = { x: e.clientX, y: e.clientY, ox: cur.x, oy: cur.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning || !panStart.current) return;
      // Aktifkan mode user hanya saat terjadi drag sungguhan (>3px),
      // supaya klik biasa tidak melompat dari mode fit ke 100%.
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (!userControlled && Math.hypot(dx, dy) < 4) return;
      if (!userControlled) {
        // Mulai drag dari mode fit: kunci skala pada skala yang sedang tampil.
        setUserControlled(true);
        setUserScale(scaleRef.current);
      }
      setPos({
        x: panStart.current.ox + dx,
        y: panStart.current.oy + dy,
      });
    },
    [isPanning, userControlled],
  );

  const endPan = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  const reset = useCallback(() => {
    // Kembali ke skala 100%, gambar terpusat di container.
    setPos({
      x: (containerSize.w - naturalWidth) / 2,
      y: (containerSize.h - naturalHeight) / 2,
    });
    setUserScale(1);
    setUserControlled(true);
  }, [containerSize, naturalWidth, naturalHeight]);

  const fit = useCallback(() => {
    // Posisikan konten terpusat: pos = (container - natural*scale) / 2
    setPos({
      x: (containerSize.w - naturalWidth * fitScale) / 2,
      y: (containerSize.h - naturalHeight * fitScale) / 2,
    });
    setUserScale(fitScale); // zoom berikutnya berlanjut dari skala fit
    setUserControlled(false);
  }, [fitScale, containerSize, naturalWidth, naturalHeight]);

  const focusBox = useCallback(
    (id: string) => {
      const b = boxes.find((x) => x.id === id);
      const el = containerRef.current;
      if (!b || !el) return;
      const rect = el.getBoundingClientRect();
      const bw = Math.max(1, b.x2 - b.x1);
      const bh = Math.max(1, b.y2 - b.y1);
      const target = Math.min(
        ZOOM_MAX,
        Math.max(fitScale * 1.2, Math.min(rect.width / (bw * 1.6), rect.height / (bh * 1.6))),
      );
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const midX = (b.x1 + b.x2) / 2;
      const midY = (b.y1 + b.y2) / 2;
      setUserScale(target);
      setUserControlled(true);
      setPos({ x: cx - midX * target, y: cy - midY * target });
    },
    [boxes, fitScale],
  );

  // Layar penuh untuk presentasi (tombol maupun tombol F; Esc keluar).
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Keyboard: + / - zoom, 0 fit, 1 100%, F fullscreen, panah geser.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomBy(ZOOM_STEP);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomBy(1 / ZOOM_STEP);
      } else if (e.key === "0") {
        e.preventDefault();
        fit();
      } else if (e.key === "1") {
        e.preventDefault();
        reset();
      } else if (e.key === "f" || e.key === "F") {
        const target = e.target as HTMLElement;
        if (target.closest("input, select, textarea")) return;
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = 40;
        setUserControlled(true);
        setUserScale((s) => s);
        setPos((p) => ({
          x: p.x + (e.key === "ArrowLeft" ? step : e.key === "ArrowRight" ? -step : 0),
          y: p.y + (e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0),
        }));
      }
    },
    [zoomBy, fit, reset, toggleFullscreen],
  );

  // Konversi koordinat natural gambar -> koordinat layar container.
  const toScreen = useCallback(
    (nx: number, ny: number) => ({
      x: viewPos.x + nx * scale,
      y: viewPos.y + ny * scale,
    }),
    [viewPos, scale],
  );

  // Fokus dari tabel (tombol "Fokus" per baris). Dijaga dengan counter agar
  // hanya berjalan sekali per klik — bukan tiap render (boxes dibuat ulang
  // di parent sehingga identitas focusBox bisa berubah tanpa klik baru).
  const handledFocusN = useRef(0);
  useEffect(() => {
    if (focusRequest && handledFocusN.current !== focusRequest.n) {
      handledFocusN.current = focusRequest.n;
      focusBox(focusRequest.id);
    }
  }, [focusRequest, focusBox]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Penampil gambar PCB. Gunakan tombol plus minus untuk zoom, 0 untuk pas layar, 1 untuk 100 persen, F untuk layar penuh."
      onKeyDown={handleKeyDown}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-surface-tile-1 focus:outline-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      style={{ cursor: isPanning ? "grabbing" : "grab" }}
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button")) return;
        zoomBy(ZOOM_STEP, e.clientX, e.clientY);
      }}
    >
      {/* Lapisan gambar — origin 0,0 (kiri-atas) */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: naturalWidth,
          height: naturalHeight,
          transform: `translate(${viewPos.x}px, ${viewPos.y}px) scale(${scale})`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="block h-auto w-full max-w-none"
        />
      </div>

      {/* Overlay deteksi — label penuh hanya untuk box yang disorot;
          box lain cukup badge nomor (sinkron dengan kolom # di tabel). */}
      {boxes.map((b) => {
        const p1 = toScreen(b.x1, b.y1);
        const p2 = toScreen(b.x2, b.y2);
        const w = p2.x - p1.x;
        const h = p2.y - p1.y;
        if (w < 2 || h < 2) return null;
        const highlighted = highlightId === b.id;
        const nearTop = p1.y < 26;
        const num = Number(b.id.split("-")[1] ?? 0) + 1;
        // Interaktif bila bisa diklik ATAU di-hover (viewer B hanya hover).
        const interactive = onBoxClick != null || onBoxHover != null;
        // Saat zoom dalam, box besar & berjauhan — tampilkan semua label
        // otomatis tanpa perlu hover (anti-tumpuk tetap terjaga).
        const showLabel = highlighted || scale >= LABEL_ZOOM_THRESHOLD;
        return (
          <div
            key={b.id}
            role={onBoxClick ? "button" : undefined}
            tabIndex={onBoxClick ? 0 : undefined}
            aria-label={`#${num}: ${b.label}`}
            onClick={
              onBoxClick
                ? (e) => {
                    e.stopPropagation();
                    onBoxClick(b.id);
                    focusBox(b.id);
                  }
                : undefined
            }
            onKeyDown={
              onBoxClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onBoxClick(b.id);
                      focusBox(b.id);
                    }
                  }
                : undefined
            }
            onMouseEnter={onBoxHover ? () => onBoxHover(b.id) : undefined}
            onMouseLeave={onBoxHover ? () => onBoxHover(null) : undefined}
            onFocus={onBoxHover ? () => onBoxHover(b.id) : undefined}
            onBlur={onBoxHover ? () => onBoxHover(null) : undefined}
            className={`absolute ${interactive ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}`}
            style={{
              left: p1.x,
              top: p1.y,
              width: w,
              height: h,
              border: `${highlighted ? 3 : 2}px solid ${b.color}`,
              boxShadow: highlighted
                ? `0 0 0 3px ${b.color}55, 0 0 18px ${b.color}88`
                : undefined,
              zIndex: highlighted ? 5 : 1,
            }}
          >
            {showLabel ? (
              <span
                className="absolute left-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-tight shadow-sm"
                style={{
                  backgroundColor: b.color,
                  color: "#1d1d1f",
                  top: nearTop ? 2 : -22,
                }}
              >
                {b.label}
              </span>
            ) : (
              <span
                aria-hidden
                className="absolute -left-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold leading-none shadow-sm"
                style={{ backgroundColor: b.color, color: "#1d1d1f" }}
              >
                {num}
              </span>
            )}
          </div>
        );
      })}

      {children}

      {/* Toolbar zoom — di atas tile gelap */}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/10 bg-surface-tile-2 px-1 py-0.5">
        <button
          type="button"
          onClick={() => zoomBy(1 / ZOOM_STEP)}
          aria-label="Perkecil"
          className="rounded-full p-1.5 text-body-muted transition-colors hover:bg-white/10 hover:text-body-on-dark"
        >
          <MinusIcon width={15} height={15} />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(ZOOM_STEP)}
          aria-label="Perbesar"
          className="rounded-full p-1.5 text-body-muted transition-colors hover:bg-white/10 hover:text-body-on-dark"
        >
          <PlusIcon width={15} height={15} />
        </button>
        <span className="min-w-[52px] text-center font-mono text-xs text-body-on-dark">
          {Math.round(scale * 100)}%
        </span>
        <span className="mx-1 h-4 w-px bg-white/15" />
        <button
          type="button"
          onClick={reset}
          aria-label="Atur ulang zoom (100%)"
          className="rounded-full p-1.5 text-body-muted transition-colors hover:bg-white/10 hover:text-body-on-dark"
        >
          <RotateCwIcon width={15} height={15} />
        </button>
        <button
          type="button"
          onClick={fit}
          aria-label="Sesuaikan ke layar"
          className={`rounded-full p-1.5 transition-colors ${
            !userControlled
              ? "bg-white/15 text-body-on-dark"
              : "text-body-muted hover:bg-white/10 hover:text-body-on-dark"
          }`}
        >
          <FitIcon width={15} height={15} />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Keluar layar penuh" : "Layar penuh (F)"}
          aria-pressed={isFullscreen}
          title="Layar penuh (F)"
          className={`rounded-full p-1.5 transition-colors ${
            isFullscreen
              ? "bg-white/15 text-body-on-dark"
              : "text-body-muted hover:bg-white/10 hover:text-body-on-dark"
          }`}
        >
          <ExpandIcon width={15} height={15} />
        </button>
      </div>
    </div>
  );
}
