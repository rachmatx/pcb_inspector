"use client";

import { useState } from "react";

const INPUT_CLS =
  "w-full rounded-[14px] border border-hairline bg-canvas px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-muted-48 focus:border-primary-focus";

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  minLength,
  autoComplete,
  ariaDescribedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minLength?: number;
  autoComplete?: string;
  ariaDescribedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input
        id={id}
        type={show ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-describedby={ariaDescribedBy}
        className={`${INPUT_CLS} pr-16`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        aria-pressed={show}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[13px] font-medium text-primary transition-colors hover:bg-primary/5"
      >
        {show ? "Sembunyi" : "Tampil"}
      </button>
    </span>
  );
}

export function passwordScore(pw: string): { label: string; width: string; cls: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 2) return { label: "Lemah", width: "33%", cls: "bg-red-500" };
  if (s <= 3) return { label: "Sedang", width: "66%", cls: "bg-amber-500" };
  return { label: "Kuat", width: "100%", cls: "bg-green-500" };
}
