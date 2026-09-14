/** TMDB attend une étiquette complète : "fr" seul renvoie des titres anglais. */
export function tmdbLanguage(locale: string | null | undefined): string {
  return locale === 'en' ? 'en-US' : 'fr-FR';
}
