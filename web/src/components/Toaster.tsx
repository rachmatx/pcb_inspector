"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckIcon, AlertIcon, XIcon } from "./icons";

export type ToastKind = "success" | "error" | "info";

type Toast = { id: number; kind: ToastKind; message: string };

let push: ((kind: ToastKind, message: string) => void) | null = null;

/** Pemicu toast global tanpa dependensi. Contoh: `notify("success", "Tersimpan")`. */
export function notify(kind: ToastKind, message: string) {
  push?.(kind, message);
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    let nextId = 1;
    push = (kind, message) => {
      const id = nextId++;
      setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 3600);
    };
    return () => {
      push = null;
    };
  }, [dismiss]);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className="animate-toast-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full border border-hairline bg-canvas py-2 pl-4 pr-2 text-[14px] text-ink shadow-product"
        >
          {t.kind === "success" ? (
            <CheckIcon
              width={15}
              height={15}
              className="shrink-0 text-green-700"
            />
          ) : t.kind === "error" ? (
            <AlertIcon
              width={15}
              height={15}
              className="shrink-0 text-red-600"
            />
          ) : (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
          <span className="min-w-0 flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Tutup notifikasi"
            className="shrink-0 rounded-full p-1.5 text-ink-muted-48 transition-colors hover:bg-canvas-parchment hover:text-ink"
          >
            <XIcon width={13} height={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
