"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { MobileNav, NavLinks } from "./MobileNav";

/**
 * Header untuk halaman client ("use client") — membaca sesi via
 * `authClient.useSession()` sehingga tombol Masuk/Keluar selalu benar,
 * sama seperti SiteHeader versi server.
 */
export function SiteHeaderSimple() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const user = session?.user ?? null;

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 bg-surface-black text-body-on-dark">
      <div className="relative mx-auto flex h-11 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-sm font-medium tracking-tight text-body-on-dark/90 transition-opacity hover:opacity-70"
        >
          PCB Inspector
        </Link>
        <NavLinks />
        <div className="flex items-center gap-1.5">
          {isPending ? (
            <span
              aria-hidden
              className="h-[26px] w-[64px] animate-pulse rounded-full bg-white/15"
            />
          ) : user ? (
            <>
              <span className="hidden max-w-[140px] truncate text-xs text-body-on-dark/60 md:inline">
                {user.name ?? user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition-opacity hover:opacity-80"
              >
                Keluar
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition-opacity hover:opacity-80"
            >
              Masuk
            </Link>
          )}
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
