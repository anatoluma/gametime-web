import { cookies } from 'next/headers';
import { getT, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from './index';

export async function getServerT() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = (raw === 'ro' || raw === 'ru' ? raw : DEFAULT_LOCALE);
  return getT(locale);
}
