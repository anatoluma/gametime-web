"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
// Using relative path to be 100% safe from alias errors
import { useGlobalSearch } from "../hooks/use-global-search";

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
    <header className="sticky top-0 z-50 bg-black text-white border-b-2 border-orange-600">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* LOGO */}
        <Link href="/" className="shrink-0" onClick={() => setQuery("")}>
          <div className="bg-orange-600 text-black font-black italic px-2 py-0.5 rounded text-sm">
            LBM
          </div>
        </Link>

        {/* SEARCH BAR - Forced width and bright border for troubleshooting */}
        <div className="flex-1 max-w-md relative">
          <input
            type="text"
            placeholder="Search players or teams..."
            autoComplete="off"
            className="w-full bg-neutral-800 border-2 border-white/40 rounded-full px-4 py-1.5 text-xs font-bold text-white focus:border-orange-600 outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          
          {/* Results Dropdown */}
          {query.length >= 2 && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white text-black border-4 border-black rounded-xl shadow-2xl z-[100]">
              {isSearching ? (
                <div className="p-4 text-center text-[10px] font-black uppercase text-gray-400">Searching...</div>
              ) : (
                <div className="p-2">
                  {results.teams.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[8px] font-black text-orange-600 uppercase px-2">Teams</div>
                      {results.teams.map((t: TeamResult) => (
                        <Link key={t.team_id} href={`/teams/${t.team_id}`} onClick={() => setQuery("")} className="block px-2 py-1.5 hover:bg-orange-50 rounded font-bold text-xs uppercase">{t.team_name}</Link>
                      ))}
                    </div>
                  )}
                  {results.players.length > 0 && (
                    <div>
                      <div className="text-[8px] font-black text-orange-600 uppercase px-2">Players</div>
                      {results.players.map((p: PlayerResult) => (
                        <Link key={p.player_id} href={`/players/${p.player_id}`} onClick={() => setQuery("")} className="block px-2 py-1.5 hover:bg-orange-50 rounded font-bold text-xs uppercase flex justify-between">
                          <span>{p.first_name} {p.last_name}</span>
                          <span className="text-gray-300">({p.team_id})</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* NAV LINKS */}
        <div className="hidden md:flex items-center gap-4">
          {navLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href} 
              className={`text-xs font-black uppercase tracking-widest ${pathname === link.href ? "text-orange-500" : "text-gray-400"}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}