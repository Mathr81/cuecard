import Fuse, { type FuseResult } from 'fuse.js';
import type { Cue } from './types';

export interface SearchResult {
  cue: Cue;
  /** 0 = idéal. Les correspondances exactes passent toujours devant. */
  score: number;
  /** Vrai si la requête apparaît littéralement dans la réplique. */
  exact: boolean;
}

/**
 * Les accents, la casse et la ponctuation ne doivent jamais faire échouer une
 * recherche : je tape ce que je crois lire sur l'écran de la télé, vite et mal.
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’ʼ`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Même chose sans apostrophes : "dont" doit trouver "don't". */
function withoutApostrophes(text: string): string {
  return text.replace(/'/g, '');
}

interface IndexedCue {
  cue: Cue;
  normalized: string;
  squashed: string;
}

export class CueSearchIndex {
  private readonly entries: IndexedCue[];
  private readonly fuse: Fuse<IndexedCue>;

  constructor(cues: Cue[]) {
    this.entries = cues.map((cue) => {
      const normalized = normalizeForSearch(cue.text.replace(/\n/g, ' '));
      return { cue, normalized, squashed: withoutApostrophes(normalized) };
    });

    this.fuse = new Fuse(this.entries, {
      keys: ['normalized', 'squashed'],
      // La position du mot dans la réplique n'a aucune importance.
      ignoreLocation: true,
      includeScore: true,
      threshold: 0.4,
      minMatchCharLength: 2,
    });
  }

  search(query: string, limit = 60): SearchResult[] {
    const normalizedQuery = normalizeForSearch(query);
    if (normalizedQuery.length < 2) return [];
    const squashedQuery = withoutApostrophes(normalizedQuery);

    const results = new Map<number, SearchResult>();

    // 1. Correspondances littérales : ce sont presque toujours celles que je veux.
    for (const entry of this.entries) {
      if (entry.normalized.includes(normalizedQuery) || entry.squashed.includes(squashedQuery)) {
        results.set(entry.cue.index, { cue: entry.cue, score: 0, exact: true });
      }
    }

    // 2. Approximatif pour les fautes de frappe et les mots mal entendus.
    if (results.size < limit) {
      for (const found of this.fuse.search(normalizedQuery, {
        limit,
      }) as FuseResult<IndexedCue>[]) {
        if (results.has(found.item.cue.index)) continue;
        results.set(found.item.cue.index, {
          cue: found.item.cue,
          score: (found.score ?? 1) + 0.001,
          exact: false,
        });
      }
    }

    return [...results.values()]
      .sort((a, b) => a.score - b.score || a.cue.startMs - b.cue.startMs)
      .slice(0, limit);
  }
}

/**
 * Plages à surligner dans une réplique : chaque mot de la requête retrouvé
 * dans le texte d'origine, insensible à la casse et aux accents.
 */
export function highlightRanges(text: string, query: string): Array<[number, number]> {
  const words = normalizeForSearch(query)
    .split(' ')
    .filter((w) => w.length >= 2);
  if (words.length === 0) return [];

  // La normalisation ne change pas la longueur : NFD est recomposé caractère
  // par caractère pour garder un index commun avec le texte affiché.
  const haystack = [...text]
    .map(
      (char) =>
        char.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’ʼ]/g, "'").slice(0, 1) ||
        char.toLowerCase()
    )
    .join('');

  const ranges: Array<[number, number]> = [];
  for (const word of words) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(word, from);
      if (at === -1) break;
      ranges.push([at, at + word.length]);
      from = at + word.length;
    }
  }

  return mergeRanges(ranges);
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      out.push([...range]);
    }
  }
  return out;
}
