"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useGlobalSearch } from "../../hooks/use-global-search";
import { useT } from "./LanguageProvider";
import { type Locale } from "@/lib/i18n";

interface TeamResult { team_id: string; team_name: string; }
interface PlayerResult { player_id: string; first_name: string; last_name: string; team_id: string; }

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const desktopSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const languageRef = useRef<HTMLDivElement | null>(null);
  const languageButtonRef = useRef<HTMLButtonElement | null>(null);
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [isDesktopFocused, setIsDesktopFocused] = useState(false);
  const [isMobileFocused, setIsMobileFocused] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const { results, isSearching } = useGlobalSearch(query);
  const { t, locale, setLocale } = useT();

  const shouldShowDesktopDropdown = isDesktopFocused && query.trim().length >= 2;
  const shouldShowMobileDropdown = isMobileFocused && query.trim().length >= 2;
  const hasResults = results.teams.length > 0 || results.players.length > 0;

  useEffect(() => {
    setQuery("");
    setIsDesktopFocused(false);
    setIsMobileFocused(false);
    setIsLanguageOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      const clickedInsideSearch =
        desktopSearchRef.current?.contains(target) || mobileSearchRef.current?.contains(target);

      if (!clickedInsideSearch) {
        setIsDesktopFocused(false);
        setIsMobileFocused(false);
      }

      if (languageRef.current && !languageRef.current.contains(target)) {
        setIsLanguageOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
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
    setIsLanguageOpen(false);
    languageButtonRef.current?.focus();
    router.refresh();
  };

  const languageOptions: Array<{ locale: Locale; label: string }> = [
    { locale: "en", label: "English" },
    { locale: "ro", label: "Română" },
    { locale: "ru", label: "Русский" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-black text-white border-b-2 border-orange-600 shadow-lg">
      <nav className="max-w-5xl mx-auto px-3 sm:px-6 py-2">
        <div className="flex items-center gap-2 min-h-[52px]">
          <Link href="/" className="flex items-center gap-1.5 shrink-0">
            <div className="bg-orange-600 text-black font-black italic h-10 px-3 rounded text-sm leading-none inline-flex items-center sm:h-auto sm:px-1.5 sm:py-0.5 sm:text-sm">
              LBM
            </div>
            <span className="font-black uppercase italic tracking-tighter text-base hidden xs:block">
              STATS
            </span>
          </Link>

          <div ref={mobileSearchRef} className="relative min-w-0 flex-1 sm:hidden">
            <label htmlFor="mobile-search" className="sr-only">
              {t("nav_search_placeholder")}
            </label>
            <div className="relative">
              <input
                id="mobile-search"
                ref={mobileInputRef}
                type="text"
                value={query}
                onFocus={() => {
                  setIsMobileFocused(true);
                  setIsDesktopFocused(false);
                }}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsMobileFocused(false);
                    mobileInputRef.current?.blur();
                  }
                }}
                placeholder="Search..."
                className="w-full h-10 rounded-md bg-zinc-900 border border-zinc-700 pl-8 pr-2 text-[11px] text-white placeholder:text-zinc-400 focus:outline-none focus:border-orange-500"
                aria-label={t("nav_search_placeholder")}
                aria-expanded={shouldShowMobileDropdown}
                aria-controls="mobile-site-search-results"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>

            {shouldShowMobileDropdown && (
              <div
                id="mobile-site-search-results"
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
                              setIsMobileFocused(false);
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
                              setIsMobileFocused(false);
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

            <div ref={desktopSearchRef} className="relative hidden sm:block w-[240px] md:w-[300px] shrink-0">
              <label htmlFor="site-search" className="sr-only">
                {t("nav_search_placeholder")}
              </label>
              <div className="relative">
                <input
                  id="site-search"
                  ref={desktopInputRef}
                  type="text"
                  value={query}
                  onFocus={() => {
                    setIsDesktopFocused(true);
                    setIsMobileFocused(false);
                  }}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsDesktopFocused(false);
                      desktopInputRef.current?.blur();
                    }
                  }}
                  placeholder={t("nav_search_placeholder")}
                  className="w-full h-9 rounded-md bg-zinc-900 border border-zinc-700 px-9 pr-3 text-xs sm:text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:border-orange-500"
                  aria-label={t("nav_search_placeholder")}
                  aria-expanded={shouldShowDesktopDropdown}
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

              {shouldShowDesktopDropdown && (
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
                                setIsDesktopFocused(false);
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
                                setIsDesktopFocused(false);
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

            <div ref={languageRef} className="relative">
              <button
                ref={languageButtonRef}
                type="button"
                onClick={() => setIsLanguageOpen((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsLanguageOpen(false);
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIsLanguageOpen(true);
                  }
                }}
                className="h-[38px] px-2 rounded-md border border-zinc-700 bg-zinc-900 text-[9px] sm:text-xs font-black uppercase tracking-[0.08em] text-white inline-flex items-center gap-1 leading-none"
                aria-label="Select language"
                aria-haspopup="menu"
                aria-expanded={isLanguageOpen}
                aria-controls="language-menu"
              >
                {locale.toUpperCase()}
                <span className={`transition-transform ${isLanguageOpen ? "rotate-180" : ""}`} aria-hidden="true">
                  ▾
                </span>
              </button>

              {isLanguageOpen && (
                <div
                  id="language-menu"
                  role="menu"
                  aria-label="Select language"
                  className="absolute right-0 mt-2 w-36 rounded-md border border-zinc-800 bg-zinc-950 shadow-2xl p-1"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsLanguageOpen(false);
                      languageButtonRef.current?.focus();
                    }
                  }}
                >
                  {languageOptions.map((option) => (
                    <button
                      key={option.locale}
                      type="button"
                      role="menuitemradio"
                      aria-checked={locale === option.locale}
                      onClick={() => handleLocaleChange(option.locale)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs sm:text-sm font-semibold transition-colors ${
                        locale === option.locale
                          ? "bg-orange-600/20 text-orange-400"
                          : "text-zinc-200 hover:bg-zinc-900"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

        <div className="mt-2 grid grid-cols-4 items-center gap-0">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`min-w-0 px-0.5 py-2 text-center text-[10px] sm:text-xs font-black uppercase tracking-[0.05em] transition-colors whitespace-nowrap leading-none ${
                pathname === link.href ? "text-orange-500" : "text-gray-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}