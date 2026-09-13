import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale, UI_LOCALE_COOKIE } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const stored = cookieStore.get(UI_LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : defaultLocale;

  return {
    locale,
    // Fuseau fixe : les dates rendues côté serveur et côté client doivent
    // coïncider, sinon React signale une divergence d'hydratation.
    timeZone: 'Europe/Paris',
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
