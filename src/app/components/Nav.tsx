"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGlobalSearch } from "@/hooks/use-global-search";

// Interfaces to resolve the 'any' type errors
interface TeamResult {
  team_id: string;
  team_name: string;
}

interface PlayerResult {
  player_id: string;
  first_name: string;
  last_name: string;
  team_id: string;
}

export default function Nav() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const { results, isSearching } = useGlobalSearch(query);

  const navLinks = [
    { href: "/teams", label: "Teams" },
    { href: "/games", label: "Games" },
    { href: "/leaders", label: "Leaders" },
    { href: "/standings", label: "Standings" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-black text-white border-b-2 border-orange-600 shadow-lg">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* LOGO - shrink-0 ensures it doesn't get squashed */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0" onClick={() => setQuery("")}>
          <div className="bg-orange-600 text-black font-black italic px-2 py-0.5 rounded text-sm">
            LBM
          </div>
          <span className="font-black uppercase italic tracking-tighter text-base hidden xs:block">
            LIGA<span className="text-orange-600">BASKET</span>
          </span>
        </Link>

        {/* SEARCH BAR - flex-1 forces it to fill the middle space */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search players or teams..."
            autoComplete="off"
            className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-full px-4 py-1.5 text-xs font-bold text-white focus:border-orange-600 focus:outline-none transition-all placeholder:text-zinc-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          
          {/* SEARCH RESULTS DROPDOWN */}
          {query.length >= 2 && (
            <div className="absolute top-full left-0 w-full min-w-[280px] mt-2 bg-white text-black border-4 border-black rounded-2xl overflow-hidden shadow-2xl z-[999]">
              {isSearching && (
                <div className="p-4 text-[10px] font-black uppercase animate-pulse text-center text-gray-400">
                  Scanning...
                </div>
              )}
              
              {!isSearching && results.players.length === 0 && results.teams.length === 0 && (
                <div className="p-4 text-[10px] font-black uppercase text-gray-400 text-center">
                  No results
                </div>
              )}

              {results.teams.length > 0 && (
                <div className="p-2 border-b-2 border-gray-100">
                  <div className="text-[8px] font-black text-orange-600 uppercase px-2 mb-1 tracking-widest">Teams</div>
                  {results.teams.map((t: TeamResult) => (
                    <Link key={t.team_id} href={`/teams/${t.team_id}`} onClick={() => setQuery("")} className="block px-2 py-2 hover:bg-orange-50 rounded-lg text-xs font-black uppercase">
                      {t.team_name}
                    </Link>
                  ))}
                </div>
              )}

              {results.players.length > 0 && (
                <div className="p-2">
                  <div className="text-[8px] font-black text-orange-600 uppercase px-2 mb-1 tracking-widest">Players</div>
                  {results.players.map((p: PlayerResult) => (
                    <Link key={p.player_id} href={`/players/${p.player_id}`} onClick={() => setQuery("")} className="block px-2 py-2 hover:bg-orange-50 rounded-lg text-xs font-black uppercase flex justify-between">
                      <span>{p.first_name} {p.last_name}</span>
                      <span className="text-[9px] text-gray-300">({p.team_id})</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* NAV LINKS */}
        <div className="flex items-center shrink-0">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors hover:text-orange-500 ${
                  isActive ? "text-orange-500" : "text-gray-400"
                }`}
                onClick={() => setQuery("")}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}