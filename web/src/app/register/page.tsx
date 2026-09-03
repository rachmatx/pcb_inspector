"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthLayout } from "@/components/AuthLayout";
import { notify } from "@/components/Toaster";
import { PasswordInput, passwordScore } from "@/components/PasswordInput";

const INPUT_CLS =
  "w-full rounded-[14px] border bg-canvas px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-muted-48 focus:border-primary-focus";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const score = password.length > 0 ? passwordScore(password) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Masukkan nama minimal 2 karakter.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailErr("Masukkan alamat email yang valid.");
      return;
    }
    setEmailErr(null);
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }
    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    if (error) {
      const msg = error.message ?? "Gagal mendaftar";
      setError(msg);
      notify("error", msg);
      setLoading(false);
      return;
    }
    notify("success", "Akun dibuat — selamat datang!");
    router.push("/history");
    router.refresh();
  };

  return (
    <AuthLayout
      title="Daftar"
      subtitle="Satu akun untuk menyimpan semua riwayat inspeksi Anda."
      switchText="Sudah punya akun?"
      switchHref="/login"
      switchLabel="Masuk"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="mb-1.5 block text-[13px] font-medium text-ink"
          >
            Nama
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama Anda"
            className={`${INPUT_CLS} border-hairline`}
          />
        </div>
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
            placeholder="Minimal 8 karakter"
            minLength={8}
            autoComplete="new-password"
            ariaDescribedBy="pw-help"
          />
          <div id="pw-help" className="mt-2">
            {score ? (
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas-parchment"
                  role="img"
                  aria-label={`Kekuatan kata sandi: ${score.label}`}
                >
                  <div
                    className={`h-full rounded-full transition-all ${score.cls}`}
                    style={{ width: score.width }}
                  />
                </div>
                <span className="text-[12px] text-ink-muted-48">
                  {score.label}
                </span>
              </div>
            ) : (
              <p className="text-[12px] text-ink-muted-48">
                Minimal 8 karakter — campur huruf, angka & simbol lebih kuat.
              </p>
            )}
          </div>
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
          {loading ? "Memproses…" : "Daftar"}
        </button>
      </form>
    </AuthLayout>
  );
}
