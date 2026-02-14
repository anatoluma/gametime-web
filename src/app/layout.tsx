    import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "GameTime Stats",
  description: "Basketball stats",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

type NavButtonProps = {
  href: string;
  label: string;
};

function NavButton(props: NavButtonProps) {
  return (
    <Link
      href={props.href}
      className="px-4 py-2 rounded-lg font-semibold text-sm sm:text-base
                 bg-white text-black border border-black
                 active:scale-[0.98] transition"
    >
      {props.label}
    </Link>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black">
        <header className="sticky top-0 z-50 bg-white text-black border-b border-black">
          <nav className="max-w-3xl mx-auto px-3 py-3 flex flex-wrap gap-2 justify-center">
            <NavButton href="/teams" label="Teams" />
            <NavButton href="/games" label="Games" />
            <NavButton href="/leaders" label="Leaders" />
            <NavButton href="/standings" label="Standings" />
          </nav>
        </header>

        <div className="max-w-3xl mx-auto px-3 sm:px-6 bg-white text-black min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
