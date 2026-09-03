import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/lib/actions";
import { MobileNav, NavLinks } from "./MobileNav";

export async function SiteHeader() {
  let session = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    session = null;
  }
  const user = session?.user ?? null;

  return (
    <header className="sticky top-0 z-50 bg-surface-black text-body-on-dark">
      {/* Global nav — hitam 44px */}
      <div className="relative mx-auto flex h-11 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-sm font-medium tracking-tight text-body-on-dark/90 transition-opacity hover:opacity-70"
        >
          PCB Inspector
        </Link>
        <NavLinks />
        <div className="flex items-center gap-1.5">
          {user ? (
            <>
              <span className="hidden max-w-[140px] truncate text-xs text-body-on-dark/60 md:inline">
                {user.name ?? user.email}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition-opacity hover:opacity-80"
                >
                  Keluar
                </button>
              </form>
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
