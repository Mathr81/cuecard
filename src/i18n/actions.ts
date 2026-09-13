'use server';

import { cookies } from 'next/headers';
import { isLocale, UI_LOCALE_COOKIE, type Locale } from './config';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setUiLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(UI_LOCALE_COOKIE, locale, {
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    path: '/',
  });
}
