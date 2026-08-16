"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { getT, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

export const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: getT(DEFAULT_LOCALE),
});

function toLocale(raw: string | null | undefined): Locale | null {
  if (raw === "en" || raw === "ro" || raw === "ru") {
    return raw;
  }
  return null;
}

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  try {
    const stored = toLocale(window.localStorage.getItem(LOCALE_COOKIE));
    if (stored) return stored;
  } catch {
    // Ignore localStorage access issues and fall back to cookie/default.
  }

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  const fromCookie = toLocale(match?.[1]);
  return fromCookie ?? DEFAULT_LOCALE;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads the cookie on the client; returns DEFAULT_LOCALE on the server.
  // The html[lang] set by the server layout ensures server/client locale stay in sync.
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = (next: Locale) => {
    // Write the cookie synchronously so any immediate router.refresh() call
    // (e.g. from the language switcher) picks up the new locale, not the stale one.
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`;
    try {
      window.localStorage.setItem(LOCALE_COOKIE, next);
    } catch {
      // Ignore localStorage access issues.
    }
    setLocaleState(next);
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: getT(locale) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  return useContext(LanguageContext);
}
