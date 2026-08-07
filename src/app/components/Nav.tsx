"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useGlobalSearch } from "../../hooks/use-global-search";
import { useT } from "./LanguageProvider";
import { LOCALES, type Locale } from "@/lib/i18n";

interface TeamResult { team_id: string; team_name: string; }
interface PlayerResult { player_id: string; first_name: string; last_name: string; team_id: string; }

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const { results, isSearching } = useGlobalSearch(query);
  const { t, locale, setLocale } = useT();

  const shouldShowDropdown = isFocused && query.trim().length >= 2;
  const hasResults = results.teams.length > 0 || results.players.length > 0;

  useEffect(() => {
    setQuery("");
    setIsFocused(false);
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const navLinks = [
    { href: "/teams", label: t("nav_teams") },
    { href: "/games", label: t("nav_games") },
    { href: "/leaders", label: t("nav_leaders") },
    { href: "/standings", label: t("nav_standings") },
  ];

  const handleLocaleChange = (next: Locale) => {
    setLocale(next);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 bg-black text-white border-b-2 border-orange-600 shadow-lg">
      <nav className="max-w-5xl mx-auto px-3 sm:px-6 py-2">
        <div className="flex items-center justify-between gap-3 h-10">
          <Link href="/" className="flex items-center gap-1.5 shrink-0">
            <div className="bg-orange-600 text-black font-black italic px-1.5 py-0.5 rounded text-sm">
              LBM
            </div>
            <span className="font-black uppercase italic tracking-tighter text-base hidden xs:block">
              STATS
            </span>
          </Link>

          <div ref={containerRef} className="relative w-[180px] sm:w-[240px] md:w-[300px] shrink-0">
            <label htmlFor="site-search" className="sr-only">
              {t("nav_search_placeholder")}
            </label>
            <div className="relative">
              <input
                id="site-search"
                ref={inputRef}
                type="text"
                value={query}
                onFocus={() => setIsFocused(true)}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsFocused(false);
                    inputRef.current?.blur();
                  }
                }}
                placeholder={t("nav_search_placeholder")}
                className="w-full h-9 rounded-md bg-zinc-900 border border-zinc-700 px-9 pr-3 text-xs sm:text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:border-orange-500"
                aria-label={t("nav_search_placeholder")}
                aria-expanded={shouldShowDropdown}
                aria-controls="site-search-results"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>

            {shouldShowDropdown && (
              <div
                id="site-search-results"
                className="absolute top-full mt-2 w-full rounded-md border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
              >
                {isSearching && (
                  <p className="px-3 py-2 text-xs text-zinc-400">{t("nav_searching")}</p>
                )}

                {!isSearching && !hasResults && (
                  <p className="px-3 py-2 text-xs text-zinc-400">{t("nav_no_results")}</p>
                )}

                {!isSearching && hasResults && (
                  <>
                    {results.teams.length > 0 && (
                      <div className="border-b border-zinc-800">
                        <p className="px-3 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                          {t("nav_results_teams")}
                        </p>
                        {results.teams.map((t: TeamResult) => (
                          <Link
                            key={t.team_id}
                            href={`/teams/${t.team_id}`}
                            onClick={() => {
                              setQuery("");
                              setIsFocused(false);
                            }}
                            className="block px-3 py-2 text-sm font-semibold hover:bg-zinc-900 hover:text-orange-500 transition-colors"
                          >
                            {t.team_name}
                          </Link>
                        ))}
                      </div>
                    )}

                    {results.players.length > 0 && (
                      <div>
                        <p className="px-3 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                          {t("nav_results_players")}
                        </p>
                        {results.players.map((p: PlayerResult) => (
                          <Link
                            key={p.player_id}
                            href={`/players/${p.player_id}`}
                            onClick={() => {
                              setQuery("");
                              setIsFocused(false);
                            }}
                            className="flex items-center justify-between px-3 py-2 text-sm hover:bg-zinc-900 transition-colors"
                          >
                            <span className="font-semibold hover:text-orange-500 transition-colors">
                              {p.first_name} {p.last_name}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-500">
                              {p.team_id}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-1 overflow-x-auto pb-1 no-scrollbar">
          <div className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap ${
                  pathname === link.href ? "text-orange-500" : "text-gray-400 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-0.5 shrink-0 ml-2">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => handleLocaleChange(l)}
                className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded transition-colors ${
                  locale === l
                    ? "bg-orange-600 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}