import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PCB Inspector",
  description:
    "Deteksi dan lokalisasi cacat PCB (printed circuit board) menggunakan model YOLO.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full bg-canvas text-body antialiased">
        {children}
      </body>
    </html>
  );
}
