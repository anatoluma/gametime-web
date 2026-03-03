"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
// Using a direct relative path to bypass any alias (@/) issues
import { useGlobalSearch } from "../../hooks/use-global-search";

interface TeamResult { team_id: string; team_name: string; }
interface PlayerResult { player_id: string; first_name: string; last_name: string; team_id: string; }

export default function Nav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { results, isSearching } = useGlobalSearch(query);

  // Auto-close search when moving to a new page
  useEffect(() => {
    setIsOpen(false);
    setQuery("");
  }, [pathname]);

  const navLinks = [
    { href: "/teams", label: "Teams" },
    { href: "/games", label: "Games" },
    { href: "/leaders", label: "Leaders" },
    { href: "/standings", label: "Standings" },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 bg-black text-white border-b-2 border-orange-600 shadow-lg">
        <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* LOGO */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="bg-orange-600 text-black font-black italic px-2 py-0.5 rounded rotate-2 text-sm">
              LBM
            </div>
            <span className="font-black uppercase italic tracking-tighter text-xl hidden xs:block">
              LIGA<span className="text-orange-600">BASKET</span>
            </span>
          </Link>

          {/* RIGHT SIDE: NAVIGATION & SEARCH BUTTON */}
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors ${
                    pathname === link.href ? "text-orange-500" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* SEARCH TOGGLE BUTTON */}
            <button 
              onClick={() => setIsOpen(true)}
              className="ml-2 p-2 bg-zinc-900 border-2 border-zinc-800 rounded-lg hover:border-orange-600 transition-all text-orange-600"
              aria-label="Open Search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* FULL-SCREEN SEARCH OVERLAY */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center pt-20 px-4">
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-orange-600 font-black italic uppercase tracking-tighter text-2xl">Search Database</h2>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-gray-500 hover:text-white font-black text-sm uppercase tracking-widest"
              >
                [ Close ]
              </button>
            </div>

            <input
              autoFocus
              type="text"
              placeholder="Start typing..."
              className="w-full bg-transparent border-b-4 border-orange-600 py-4 text-3xl md:text-5xl font-black uppercase italic outline-none placeholder:text-zinc-800 text-white"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* TEAMS SECTION */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] border-b border-zinc-800 pb-2">Teams</h3>
                {isSearching && <div className="text-xs font-bold text-zinc-700 animate-pulse">SEARCHING...</div>}
                {results.teams.map((t: TeamResult) => (
                  <Link key={t.team_id} href={`/teams/${t.team_id}`} className="block text-xl font-black uppercase hover:text-orange-600 transition-colors">
                    {t.team_name}
                  </Link>
                ))}
              </div>

              {/* PLAYERS SECTION */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] border-b border-zinc-800 pb-2">Players</h3>
                {isSearching && <div className="text-xs font-bold text-zinc-700 animate-pulse">SEARCHING...</div>}
                {results.players.map((p: PlayerResult) => (
                  <Link key={p.player_id} href={`/players/${p.player_id}`} className="flex justify-between items-center group">
                    <span className="text-xl font-black uppercase group-hover:text-orange-600 transition-colors">{p.first_name} {p.last_name}</span>
                    <span className="text-[10px] font-bold text-zinc-600">{p.team_id}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}