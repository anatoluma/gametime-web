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

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest hover:text-orange-500 transition-colors shrink-0"
    >
      {label}
    </Link>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100 antialiased">
        {/* COMPACT NAV */}
        <header className="sticky top-0 z-50 bg-black text-white border-b-2 border-orange-600 shadow-lg">
          <nav className="max-w-5xl mx-auto px-2 sm:px-6 h-14 flex items-center justify-between overflow-hidden">
            
            {/* BRAND - Minimalized to save space */}
            <Link href="/" className="flex items-center gap-1.5 shrink-0 mr-2">
              <div className="bg-orange-600 text-black font-black italic px-1.5 py-0.5 rounded text-sm">
                GT
              </div>
              <span className="font-black uppercase italic tracking-tighter text-base hidden xs:block">
                STATS
              </span>
            </Link>

            {/* NAV ITEMS - Tight spacing to prevent overflow */}
            <div className="flex items-center">
              <NavItem href="/teams" label="Teams" />
              <NavItem href="/games" label="Games" />
              <NavItem href="/leaders" label="Leaders" />
              <NavItem href="/standings" label="Standings" />
            </div>
          </nav>
        </header>

        {/* CONTENT CONTAINER */}
        <div className="max-w-5xl mx-auto bg-white min-h-screen border-x border-gray-200">
          {children}
        </div>

        <footer className="max-w-5xl mx-auto py-6 text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-white border-x border-gray-200">
          © 2026 GT Stats
        </footer>
      </body>
    </html>
  );
}