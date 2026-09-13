export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fr';
/** La langue de l'interface est indépendante de celle des explications du LLM. */
export const UI_LOCALE_COOKIE = 'cuecard.ui-locale';

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value);
}
