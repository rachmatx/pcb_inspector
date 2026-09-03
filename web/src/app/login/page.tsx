"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthLayout } from "@/components/AuthLayout";
import { notify } from "@/components/Toaster";
import { PasswordInput } from "@/components/PasswordInput";

const INPUT_CLS =
  "w-full rounded-[14px] border bg-canvas px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-muted-48 focus:border-primary-focus";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/history";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailErr("Masukkan alamat email yang valid.");
      return;
    }
    setEmailErr(null);
    if (password.length < 1) {
      setError("Masukkan kata sandi.");
      return;
    }
    setLoading(true);
    const { error } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    if (error) {
      const msg = error.message ?? "Gagal masuk — periksa email & kata sandi.";
      setError(msg);
      notify("error", msg);
      setLoading(false);
      return;
    }
    notify("success", "Berhasil masuk.");
    router.push(next);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-[13px] font-medium text-ink"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@contoh.com"
          aria-invalid={emailErr ? true : undefined}
          aria-describedby={emailErr ? "email-err" : undefined}
          className={`${INPUT_CLS} ${
            emailErr ? "border-red-500" : "border-hairline"
          }`}
        />
        {emailErr && (
          <p id="email-err" className="mt-1.5 text-[13px] text-red-600">
            {emailErr}
          </p>
        )}
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-[13px] font-medium text-ink"
        >
          Kata sandi
        </label>
        <PasswordInput
          id="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-[11px] bg-red-500/5 px-3 py-2.5 text-[13px] text-red-600"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="pressable w-full rounded-[14px] bg-primary py-3 text-[16px] font-medium text-white transition-colors hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
      >
        {loading ? "Memproses…" : "Masuk"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout
      title="Masuk"
      subtitle="Hasil inspeksi otomatis tersimpan ke riwayat saat Anda masuk."
      switchText="Belum punya akun?"
      switchHref="/register"
      switchLabel="Daftar"
    >
      <Suspense
        fallback={<p className="text-ink-muted-48">Memuat halaman masuk…</p>}
      >
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
