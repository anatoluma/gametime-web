import { translations, type Locale, type TranslationKey } from './translations';

export { type Locale, type TranslationKey };
export { translations };

export const LOCALE_COOKIE = 'lbm_locale';
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALES: Locale[] = ['en', 'ro', 'ru'];

export function getT(locale: Locale) {
  const dict = translations[locale] ?? translations.en;
  return function t(key: TranslationKey): string {
    return (dict as Record<string, string>)[key]
      ?? (translations.en as Record<string, string>)[key]
      ?? key;
  };
}
