import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { HistoryClient } from "@/components/HistoryClient";

export const metadata = { title: "Riwayat — PCB Inspector" };

export default async function HistoryPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login?next=/history");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[980px] flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          Riwayat Inspeksi
        </h1>
        <p className="mt-1 text-ink-muted-80">
          Halo, {session.user.name} — berikut 10 inspeksi terakhir Anda.
        </p>
        <HistoryClient />
      </main>
      <Footer />
    </>
  );
}
