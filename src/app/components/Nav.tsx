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

  return (
    <nav className="sticky top-0 z-50 bg-black text-white border-b-2 border-orange-600 shadow-2xl">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16 gap-2 md:gap-4">
        
        {/* LOGO - shrink-0 prevents it from disappearing */}
        <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setQuery("")}>
          <div className="bg-orange-600 text-black font-black italic px-2 py-0.5 rounded rotate-2 text-sm">
            LBM
          </div>
        </Link>

        {/* SEARCH BAR - Visible on Mobile and Desktop */}
        <div className="relative flex-1 max-w-[150px] sm:max-w-md">
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-white/10 border-2 border-white/20 rounded-full px-3 md:px-4 py-1 text-[10px] md:text-xs font-bold focus:border-orange-600 focus:outline-none transition-all placeholder:text-gray-500 text-white"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          
          {query.length >= 2 && (
            <div className="absolute top-full left-0 w-[250px] md:w-full mt-2 bg-white text-black border-4 border-black rounded-2xl overflow-hidden shadow-2xl z-[70]">
              {isSearching && <div className="p-3 text-[10px] font-black uppercase animate-pulse text-center">Searching...</div>}
              {!isSearching && results.players.length === 0 && results.teams.length === 0 && (
                <div className="p-3 text-[10px] font-black uppercase text-gray-400 text-center">No results</div>
              )}
              {results.teams.length > 0 && (
                <div className="p-2 border-b-2 border-gray-100">
                  <div className="text-[8px] font-black text-orange-600 uppercase px-2 mb-1">Teams</div>
                  {results.teams.map((t: TeamResult) => (
                    <Link key={t.team_id} href={`/teams/${t.team_id}`} onClick={() => setQuery("")} className="block px-2 py-1.5 hover:bg-orange-50 rounded-lg text-xs font-black uppercase">{t.team_name}</Link>
                  ))}
                </div>
              )}
              {results.players.length > 0 && (
                <div className="p-2">
                  <div className="text-[8px] font-black text-orange-600 uppercase px-2 mb-1">Players</div>
                  {results.players.map((p: PlayerResult) => (
                    <Link key={p.player_id} href={`/players/${p.player_id}`} onClick={() => setQuery("")} className="block px-2 py-1.5 hover:bg-orange-50 rounded-lg text-xs font-black uppercase">
                      {p.first_name} {p.last_name} <span className="text-[9px] text-gray-300">({p.team_id})</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* NAV LINKS - shrink-0 helps layout stability */}
        <div className="flex h-full shrink-0 overflow-x-auto no-scrollbar">
          {["Teams", "Games", "Leaders", "Standings"].map((label) => {
            const href = `/${label.toLowerCase()}`;
            const isActive = pathname === href;
            return (
              <Link key={label} href={href} className={`relative flex items-center px-2 md:px-3 text-[9px] md:text-xs font-black uppercase tracking-tighter ${isActive ? "text-orange-500" : "text-gray-400"}`}>
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}