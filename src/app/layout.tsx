import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "GameTime Stats",
  description: "Basketball stats",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

function NavButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  // We avoid relying on subtle colors because mobile browser dark-mode can wash them out.
  // Use strong contrast always.
  return (
    <Link
      href={href}
      className="px-4 py-2 rounded-lg font-semibold text-sm sm:text-base
                 bg-white text-black border border-black
                 active:scale-[0.98] transition"
    >
      {label}
    </Link>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        <header className="sticky top-0 z-50 bg-white text-black border-b border-black">
          <nav className="max-w-3xl mx-auto px-3 py-3 flex gap-2 justify-center">
            <NavButton href="/teams" label="Teams" />
            <NavButton href="/games" label="Games" />
            <NavButton href="/leaders" label="Leaders" />
          </nav>
        </header>

        <div className="max-w-3xl mx-auto px-3 sm:px-6">{children}</div>
      </body>
    </html>
  );
}
