"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/teams", label: "Teams" },
    { href: "/games", label: "Schedule" },
    { href: "/leaders", label: "Leaders" },
    { href: "/standings", label: "Standings" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-black text-white border-b-2 border-orange-600 shadow-2xl">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        
        {/* LOGO SECTION */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-orange-600 text-black font-black italic px-2 py-0.5 rounded rotate-2 group-hover:rotate-0 transition-transform">
            B-BALL
          </div>
          <span className="font-black uppercase italic tracking-tighter text-xl hidden sm:inline">
            League<span className="text-orange-600">DB</span>
          </span>
        </Link>

        {/* NAV ITEMS */}
        <div className="flex h-full">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center px-4 md:px-6 h-full text-[11px] md:text-xs font-black uppercase tracking-[0.2em] transition-all
                  ${isActive ? "text-orange-500" : "text-gray-400 hover:text-white"}`}
              >
                {link.label}
                {/* Underline Indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-600" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}