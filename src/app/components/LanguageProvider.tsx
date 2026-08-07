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

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  const raw = match?.[1];
  return raw === "ro" || raw === "ru" ? raw : DEFAULT_LOCALE;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads the cookie on the client; returns DEFAULT_LOCALE on the server.
  // The html[lang] set by the server layout ensures server/client locale stay in sync.
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`;
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
