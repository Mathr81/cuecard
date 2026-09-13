export interface ExternalLink {
  id: 'wordreference' | 'youglish' | 'wiktionary';
  label: string;
  description: string;
  href: string;
}

/**
 * De simples liens : aucun scraping, aucune clé, et ces trois sites font
 * chacun mieux que l'app sur leur terrain (traduction, prononciation réelle,
 * étymologie et expressions).
 */
export function externalLinks(term: string): ExternalLink[] {
  const encoded = encodeURIComponent(term.toLowerCase().trim());
  const underscored = encodeURIComponent(term.toLowerCase().trim().replace(/\s+/g, '_'));

  return [
    {
      id: 'wordreference',
      label: 'WordReference',
      description: 'EN → FR',
      href: `https://www.wordreference.com/enfr/${encoded}`,
    },
    {
      id: 'youglish',
      label: 'Youglish',
      description: 'prononciation',
      href: `https://youglish.com/pronounce/${encoded}/english`,
    },
    {
      id: 'wiktionary',
      label: 'Wiktionary',
      description: 'étymologie',
      href: `https://en.wiktionary.org/wiki/${underscored}`,
    },
  ];
}
