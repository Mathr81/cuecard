import { z } from 'zod';
import { envOr } from '@/lib/env';
import type { DictionaryEntry, DictionaryMeaning } from '../types';
import { ProviderUnavailableError, type DictionaryProvider } from './types';

/**
 * api.datamuse.com : dernier recours. Les définitions y sont plus sèches
 * (pas de phonétique, pas d'exemples), mais l'infrastructure est indépendante
 * des deux autres, ce qui est tout l'intérêt : quand elles tombent ensemble,
 * il reste quelque chose à afficher.
 */
const BASE_URL = envOr('DATAMUSE_API_URL', 'https://api.datamuse.com/words');

/** Les définitions arrivent préfixées de la nature grammaticale, tabulée. */
const PART_OF_SPEECH: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
};

const MAX_DEFINITIONS_PER_PART = 8;

const payloadSchema = z.array(
  z.object({
    word: z.string(),
    defs: z.array(z.string()).nullish(),
  })
);

function groupMeanings(defs: readonly string[]): DictionaryMeaning[] {
  const grouped = new Map<string, DictionaryMeaning>();

  for (const raw of defs) {
    const separator = raw.indexOf('\t');
    if (separator < 0) continue;

    const partOfSpeech = PART_OF_SPEECH[raw.slice(0, separator)];
    const text = raw.slice(separator + 1).trim();
    if (!partOfSpeech || !text) continue;

    const meaning = grouped.get(partOfSpeech) ?? { partOfSpeech, definitions: [], synonyms: [] };
    if (
      meaning.definitions.length < MAX_DEFINITIONS_PER_PART &&
      !meaning.definitions.some((existing) => existing.text === text)
    ) {
      meaning.definitions.push({ text, example: null, synonyms: [] });
    }
    grouped.set(partOfSpeech, meaning);
  }

  return [...grouped.values()];
}

export const datamuseProvider: DictionaryProvider = {
  id: 'datamuse',
  supportsPhrases: true,
  timeoutMs: 8_000,

  async lookup(word, signal) {
    const url = `${BASE_URL}?${new URLSearchParams({ sp: word, md: 'd', max: '1' })}`;

    let response: Response;
    try {
      response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    } catch (cause) {
      throw new ProviderUnavailableError('datamuse', String(cause));
    }

    if (!response.ok) {
      throw new ProviderUnavailableError('datamuse', `HTTP ${response.status}`);
    }

    const parsed = payloadSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new ProviderUnavailableError('datamuse', 'réponse inattendue');
    }

    // `sp` est un motif d'orthographe : sans cette vérification, un mot absent
    // pourrait revenir sous la forme d'un voisin.
    const match = parsed.data[0];
    if (!match || match.word.toLowerCase() !== word.toLowerCase()) return null;

    const meanings = groupMeanings(match.defs ?? []);
    if (meanings.length === 0) return null;

    return {
      requested: word,
      word: match.word,
      phonetic: null,
      audio: null,
      meanings,
      source: { id: 'datamuse', url: null, license: null },
    } satisfies DictionaryEntry;
  },
};
