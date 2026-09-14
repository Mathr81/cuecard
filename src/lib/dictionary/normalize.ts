import { z } from 'zod';
import type { DictionaryEntry, DictionaryMeaning } from './types';

const definitionSchema = z.object({
  definition: z.string(),
  example: z.string().nullish(),
  synonyms: z.array(z.string()).nullish(),
});

const meaningSchema = z.object({
  partOfSpeech: z.string(),
  definitions: z.array(definitionSchema),
  synonyms: z.array(z.string()).nullish(),
});

const phoneticSchema = z.object({
  text: z.string().nullish(),
  audio: z.string().nullish(),
});

const entrySchema = z.object({
  word: z.string(),
  phonetic: z.string().nullish(),
  phonetics: z.array(phoneticSchema).nullish(),
  meanings: z.array(meaningSchema),
  sourceUrls: z.array(z.string()).nullish(),
});

export const dictionaryResponseSchema = z.array(entrySchema).min(1);

export type UpstreamEntry = z.infer<typeof entrySchema>;

/** L'extrait sonore le plus utile d'abord : l'américain, puis le britannique. */
function pickAudio(entries: UpstreamEntry[]): DictionaryEntry['audio'] {
  const candidates = entries
    .flatMap((entry) => entry.phonetics ?? [])
    .filter((phonetic): phonetic is { text?: string | null; audio: string } =>
      Boolean(phonetic.audio && phonetic.audio.trim().length > 0)
    );

  const byAccent = (suffix: string) =>
    candidates.find((phonetic) => phonetic.audio.includes(`-${suffix}.`));

  const chosen = byAccent('us') ?? byAccent('uk') ?? byAccent('au') ?? candidates[0];
  if (!chosen) return null;

  const accent = /-(us|uk|au)\./.exec(chosen.audio)?.[1] ?? null;
  return { url: chosen.audio, accent };
}

function pickPhonetic(entries: UpstreamEntry[]): string | null {
  for (const entry of entries) {
    if (entry.phonetic?.trim()) return entry.phonetic.trim();
    const fromList = entry.phonetics?.find((phonetic) => phonetic.text?.trim());
    if (fromList?.text) return fromList.text.trim();
  }
  return null;
}

/**
 * L'API renvoie plusieurs entrées pour un même mot, chacune avec ses propres
 * natures grammaticales. On les regroupe : je veux « verbe » une seule fois,
 * avec toutes ses définitions dessous.
 */
function groupMeanings(entries: UpstreamEntry[]): DictionaryMeaning[] {
  const grouped = new Map<string, DictionaryMeaning>();

  for (const entry of entries) {
    for (const meaning of entry.meanings) {
      const key = meaning.partOfSpeech.toLowerCase();
      const existing = grouped.get(key) ?? {
        partOfSpeech: key,
        definitions: [],
        synonyms: [],
      };

      for (const definition of meaning.definitions) {
        const text = definition.definition.trim();
        if (!text || existing.definitions.some((d) => d.text === text)) continue;
        existing.definitions.push({
          text,
          example: definition.example?.trim() || null,
          synonyms: unique(definition.synonyms ?? []).slice(0, 6),
        });
      }

      existing.synonyms = unique([...existing.synonyms, ...(meaning.synonyms ?? [])]).slice(0, 8);
      grouped.set(key, existing);
    }
  }

  return [...grouped.values()].filter((meaning) => meaning.definitions.length > 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeDictionaryResponse(
  payload: unknown,
  requested: string
): DictionaryEntry | null {
  const parsed = dictionaryResponseSchema.safeParse(payload);
  if (!parsed.success) return null;

  const entries = parsed.data;
  const meanings = groupMeanings(entries);
  if (meanings.length === 0) return null;

  return {
    requested,
    word: entries[0].word,
    phonetic: pickPhonetic(entries),
    audio: pickAudio(entries),
    meanings,
    source: {
      id: 'dictionaryapi',
      url: unique(entries.flatMap((entry) => entry.sourceUrls ?? []))[0] ?? null,
      license: null,
    },
  };
}
