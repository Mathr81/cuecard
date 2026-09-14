import { cookies } from 'next/headers';
import { isLocale, type Locale } from './config';

/** La langue des explications est indépendante de celle de l'interface :
 *  on peut vouloir une app en français et des explications en anglais. */
export const CONTENT_LOCALE_COOKIE = 'cuecard.content-locale';

export async function contentLocale(): Promise<Locale> {
  const stored = (await cookies()).get(CONTENT_LOCALE_COOKIE)?.value;
  return isLocale(stored) ? stored : 'fr';
}
