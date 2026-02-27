"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGlobalSearch } from "@/hooks/use-global-search";

interface TeamResult { team_id: string; team_name: string; }
interface PlayerResult { player_id: string; first_name: string; last_name: string; team_id: string; }

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
    <nav className="sticky top-0 z-50 bg-black text-white border-b-2 border-orange-600 shadow-2xl">
      <div className="max-w-6xl mx-auto px-4 flex items-center h-16 gap-4">
        
        {/* LOGO - Forced visible and un-squashable */}
        <Link href="/" className="flex-shrink-0" onClick={() => setQuery("")}>
          <div className="bg-orange-600 text-black font-black italic px-2 py-0.5 rounded rotate-2 text-sm">
            LBM
          </div>
        </Link>

        {/* SEARCH BAR - Forced width and high-contrast colors */}
        <div className="relative flex-grow max-w-md">
          <input
            type="text"
            placeholder="Search..."
            autoComplete="off"
            className="w-full bg-neutral-800 border-2 border-neutral-700 rounded-full px-4 py-1.5 text-[12px] font-bold text-white focus:border-orange-600 focus:outline-none placeholder:text-neutral-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          
          {/* Results Dropdown */}
          {query.length >= 2 && (
            <div className="absolute top-full left-0 w-full min-w-[280px] mt-2 bg-white text-black border-4 border-black rounded-2xl overflow-hidden shadow-2xl z-[999]">
              {isSearching && <div className="p-4 text-[10px] font-black uppercase animate-pulse text-center text-gray-400">Searching...</div>}
              {!isSearching && results.players.length === 0 && results.teams.length === 0 && (
                <div className="p-4 text-[10px] font-black uppercase text-gray-400 text-center">No results found</div>
              )}
              {results.teams.length > 0 && (
                <div className="p-2 border-b-2 border-gray-100">
                  <div className="text-[8px] font-black text-orange-600 uppercase px-2 mb-1">Teams</div>
                  {results.teams.map((t: TeamResult) => (
                    <Link key={t.team_id} href={`/teams/${t.team_id}`} onClick={() => setQuery("")} className="block px-2 py-2 hover:bg-orange-50 rounded-lg text-xs font-black uppercase">{t.team_name}</Link>
                  ))}
                </div>
              )}
              {results.players.length > 0 && (
                <div className="p-2">
                  <div className="text-[8px] font-black text-orange-600 uppercase px-2 mb-1">Players</div>
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

        {/* NAV LINKS - Forced to stay on the right */}
        <div className="hidden sm:flex items-center gap-1 md:gap-4 flex-shrink-0 ml-auto">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href} 
                className={`text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors ${isActive ? "text-orange-500" : "text-gray-400 hover:text-white"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}