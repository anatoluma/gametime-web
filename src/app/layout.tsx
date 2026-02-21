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

// Simplified, cleaner Nav Link
function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 text-xs font-black uppercase tracking-[0.2em] hover:text-orange-600 transition-colors shrink-0"
    >
      {label}
    </Link>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100">
        {/* MAIN NAV HEADER */}
        <header className="sticky top-0 z-50 bg-black text-white border-b-2 border-orange-600 shadow-xl">
          <nav className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            {/* BRAND */}
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <div className="bg-orange-600 text-black font-black italic px-2 py-0.5 rounded rotate-2 group-hover:rotate-0 transition-all">
                GT
              </div>
              <span className="font-black uppercase italic tracking-tighter text-lg hidden xs:inline">
                GameTime<span className="text-orange-600">Stats</span>
              </span>
            </Link>

            {/* LINKS - Scrollable on very small screens */}
            <div className="flex items-center overflow-x-auto no-scrollbar ml-4">
              <NavItem href="/teams" label="Teams" />
              <NavItem href="/games" label="Games" />
              <NavItem href="/leaders" label="Leaders" />
              <NavItem href="/standings" label="Standings" />
            </div>
          </nav>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        {/* Increased width to 5xl to let your data breathe */}
        <div className="max-w-5xl mx-auto bg-white min-h-screen shadow-2xl border-x border-gray-200">
          {children}
        </div>

        {/* SIMPLE FOOTER */}
        <footer className="max-w-5xl mx-auto py-8 text-center text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] bg-white border-x border-gray-200">
          © 2026 GameTime Stats • Professional League Data
        </footer>
      </body>
    </html>
  );
}
