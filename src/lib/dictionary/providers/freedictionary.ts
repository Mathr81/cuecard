import { z } from 'zod';
import { envOr } from '@/lib/env';
import type { DictionaryEntry, DictionaryMeaning } from '../types';
import { ProviderUnavailableError, type DictionaryProvider } from './types';

/**
 * freedictionaryapi.com : le Wiktionary anglais servi déjà découpé, sans clé
 * et sans balisage à nettoyer. Il résout lui-même les formes fléchies et les
 * expressions ("pull off"), ce qu'aucune autre source gratuite ne fait.
 */
const BASE_URL = envOr('FREEDICTIONARY_API_URL', 'https://freedictionaryapi.com/api/v1/entries/en');

const senseSchema = z.object({
  definition: z.string(),
  examples: z.array(z.string()).nullish(),
  synonyms: z.array(z.string()).nullish(),
});

const entrySchema = z.object({
  language: z.object({ code: z.string() }).nullish(),
  partOfSpeech: z.string(),
  pronunciations: z
    .array(z.object({ type: z.string().nullish(), text: z.string().nullish() }))
    .nullish(),
  senses: z.array(senseSchema),
  synonyms: z.array(z.string()).nullish(),
});

const payloadSchema = z.object({
  word: z.string(),
  entries: z.array(entrySchema),
  source: z
    .object({
      url: z.string().nullish(),
      license: z.object({ name: z.string().nullish() }).nullish(),
    })
    .nullish(),
});

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/** Une nature grammaticale par section, toutes définitions regroupées dessous. */
function groupMeanings(entries: z.infer<typeof entrySchema>[]): DictionaryMeaning[] {
  const grouped = new Map<string, DictionaryMeaning>();

  for (const entry of entries) {
    const key = entry.partOfSpeech.toLowerCase().trim();
    if (!key) continue;

    const meaning = grouped.get(key) ?? { partOfSpeech: key, definitions: [], synonyms: [] };

    for (const sense of entry.senses) {
      const text = sense.definition.trim();
      if (!text || meaning.definitions.some((existing) => existing.text === text)) continue;
      meaning.definitions.push({
        text,
        example: sense.examples?.find((example) => example.trim())?.trim() ?? null,
        synonyms: unique(sense.synonyms ?? []).slice(0, 6),
      });
    }

    meaning.synonyms = unique([...meaning.synonyms, ...(entry.synonyms ?? [])]).slice(0, 8);
    grouped.set(key, meaning);
  }

  return [...grouped.values()].filter((meaning) => meaning.definitions.length > 0);
}

function pickPhonetic(entries: z.infer<typeof entrySchema>[]): string | null {
  for (const entry of entries) {
    const ipa = entry.pronunciations?.find(
      (pronunciation) => pronunciation.type === 'ipa' && pronunciation.text?.trim()
    );
    if (ipa?.text) return ipa.text.trim();
  }
  return null;
}

export const freeDictionaryProvider: DictionaryProvider = {
  id: 'freedictionary',
  supportsPhrases: true,
  timeoutMs: 8_000,

  async lookup(word, signal) {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/${encodeURIComponent(word)}`, {
        signal,
        headers: { Accept: 'application/json' },
      });
    } catch (cause) {
      throw new ProviderUnavailableError('freedictionary', String(cause));
    }

    if (!response.ok) {
      throw new ProviderUnavailableError('freedictionary', `HTTP ${response.status}`);
    }

    const parsed = payloadSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new ProviderUnavailableError('freedictionary', 'réponse inattendue');
    }

    // Un mot inconnu n'est pas une erreur ici : la réponse est un 200 avec une
    // liste d'entrées vide.
    const english = parsed.data.entries.filter(
      (entry) => !entry.language?.code || entry.language.code === 'en'
    );
    const meanings = groupMeanings(english);
    if (meanings.length === 0) return null;

    return {
      requested: word,
      word: parsed.data.word,
      phonetic: pickPhonetic(english),
      // Cette source ne publie que l'API phonétique, pas d'enregistrement.
      audio: null,
      meanings,
      source: {
        id: 'freedictionary',
        url: parsed.data.source?.url ?? null,
        license: parsed.data.source?.license?.name ?? null,
      },
    } satisfies DictionaryEntry;
  },
};
