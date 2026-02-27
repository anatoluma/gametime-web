"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGlobalSearch } from "@/hooks/use-global-search";

// Define interfaces for the search result items to fix the 'any' type error
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
    { href: "/games", label: "Schedule" },
    { href: "/leaders", label: "Leaders" },
    { href: "/standings", label: "Standings" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-black text-white border-b-2 border-orange-600 shadow-2xl">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16 gap-4">
        
        {/* LOGO SECTION */}
        <Link href="/" className="flex items-center gap-2 group shrink-0" onClick={() => setQuery("")}>
          <div className="bg-orange-600 text-black font-black italic px-2 py-0.5 rounded rotate-2 group-hover:rotate-0 transition-transform text-sm">
            LBM
          </div>
          <span className="font-black uppercase italic tracking-tighter text-xl hidden lg:inline">
            LIGA<span className="text-orange-600">BASKET</span>
          </span>
        </Link>

        {/* SEARCH BAR */}
        <div className="relative flex-1 max-w-md hidden md:block">
          <input
            type="text"
            placeholder="Search players or teams..."
            className="w-full bg-white/10 border-2 border-white/20 rounded-full px-4 py-1 text-xs font-bold focus:border-orange-600 focus:outline-none transition-all placeholder:text-gray-500 text-white"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          
          {/* SEARCH RESULTS DROPDOWN */}
          {query.length >= 2 && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white text-black border-4 border-black rounded-2xl overflow-hidden shadow-2xl z-[60]">
              {isSearching && (
                <div className="p-4 text-[10px] font-black uppercase animate-pulse text-gray-400 text-center">
                  Scanning Database...
                </div>
              )}
              
              {!isSearching && results.players.length === 0 && results.teams.length === 0 && (
                <div className="p-4 text-[10px] font-black uppercase text-gray-400 text-center">
                  No matches found
                </div>
              )}

              {results.teams.length > 0 && (
                <div className="p-2 border-b-2 border-gray-100">
                  <div className="text-[8px] font-black text-orange-600 uppercase px-2 mb-1 tracking-widest">
                    Teams
                  </div>
                  {results.teams.map((t: TeamResult) => (
                    <Link 
                      key={t.team_id} 
                      href={`/teams/${t.team_id}`} 
                      onClick={() => setQuery("")} 
                      className="block px-2 py-1.5 hover:bg-orange-50 rounded-lg text-xs font-black uppercase transition-colors"
                    >
                      {t.team_name}
                    </Link>
                  ))}
                </div>
              )}

              {results.players.length > 0 && (
                <div className="p-2">
                  <div className="text-[8px] font-black text-orange-600 uppercase px-2 mb-1 tracking-widest">
                    Players
                  </div>
                  {results.players.map((p: PlayerResult) => (
                    <Link 
                      key={p.player_id} 
                      href={`/players/${p.player_id}`} 
                      onClick={() => setQuery("")} 
                      className="block px-2 py-1.5 hover:bg-orange-50 rounded-lg text-xs font-black uppercase transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span>{p.first_name} {p.last_name}</span>
                        <span className="text-[9px] text-gray-300">({p.team_id})</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* NAV ITEMS */}
        <div className="flex h-full shrink-0">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center px-2 md:px-4 h-full text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
                  isActive ? "text-orange-500" : "text-gray-400 hover:text-white"
                }`}
                onClick={() => setQuery("")}
              >
                {link.label}
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