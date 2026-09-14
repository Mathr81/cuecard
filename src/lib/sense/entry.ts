import { z } from 'zod';
import { alias, plain, REGISTERS } from './schema';

/**
 * L'entrée bilingue générale : ce que le mot veut dire en soi, pas dans la
 * réplique où on vient de taper dessus. C'est elle qu'on révise, elle qui part
 * sur une carte Anki — la traduction contextuelle, elle, ne sert qu'une fois.
 */

/** Les identifiants sont ceux du dictionnaire anglais : les libellés traduits
 *  existent déjà sous `definition.partOfSpeech`, autant ne pas les réécrire. */
export const ENTRY_PARTS = [
  'noun',
  'verb',
  'phrasal verb',
  'adjective',
  'adverb',
  'phrase',
  'interjection',
  'pronoun',
  'preposition',
  'conjunction',
  'determiner',
] as const;

const exampleSchema = z.object({
  en: z.string().min(1).max(220),
  fr: z.string().min(1).max(220),
});

export const wordEntrySchema = z.object({
  /** Les sens du mot, du plus courant au plus rare à l'oral. */
  traductions: z
    .array(
      z.object({
        nature: z.enum(ENTRY_PARTS),
        /** Les équivalents français, le plus naturel d'abord. */
        equivalents: z.array(z.string().min(1).max(80)).min(1).max(4),
        /** Ce qui distingue ce sens des autres, quand ils se ressemblent. */
        precision: z.string().max(200).nullable(),
        registre: z.enum(REGISTERS),
        exemple: exampleSchema.nullable(),
      })
    )
    .min(1)
    .max(6),
  /** Les tournures figées bâties sur le mot : c'est là que l'anglais parlé se joue. */
  expressions: z.array(exampleSchema).max(5),
  /** Un faux-ami, ou une confusion que les francophones font vraiment. */
  piege: z.string().max(400).nullable(),
});

export type WordEntry = z.infer<typeof wordEntrySchema>;

const PART_ALIASES: Record<string, (typeof ENTRY_PARTS)[number]> = {
  noun: 'noun',
  nom: 'noun',
  substantif: 'noun',
  verb: 'verb',
  verbe: 'verb',
  'phrasal verb': 'phrasal verb',
  'verbe a particule': 'phrasal verb',
  'phrasal verbe': 'phrasal verb',
  adjective: 'adjective',
  adjectif: 'adjective',
  adj: 'adjective',
  adverb: 'adverb',
  adverbe: 'adverb',
  adv: 'adverb',
  phrase: 'phrase',
  expression: 'phrase',
  locution: 'phrase',
  idiom: 'phrase',
  idiome: 'phrase',
  interjection: 'interjection',
  exclamation: 'interjection',
  pronoun: 'pronoun',
  pronom: 'pronoun',
  preposition: 'preposition',
  conjunction: 'conjunction',
  conjonction: 'conjunction',
  determiner: 'determiner',
  determinant: 'determiner',
  article: 'determiner',
};

function cleanExample(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return null;
  const { en, fr } = value as { en?: unknown; fr?: unknown };
  if (typeof en !== 'string' || typeof fr !== 'string') return null;
  return en.trim() && fr.trim() ? { en: en.trim(), fr: fr.trim() } : null;
}

function cleanNullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  const flat = plain(text);
  return flat === 'null' || flat === 'none' || flat === 'aucun' ? null : text;
}

/**
 * Rapproche une réponse presque conforme du contrat. Les modèles répondent
 * « verbe » plutôt que « verb », ou rendent un seul équivalent sous forme de
 * chaîne : ce sont les mêmes données, une relance ne les changerait pas.
 */
export function normalizeEntryCandidate(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const candidate = { ...(value as Record<string, unknown>) };

  if (Array.isArray(candidate.traductions)) {
    candidate.traductions = candidate.traductions
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => {
        const sense = { ...item };
        sense.nature = alias(sense.nature, PART_ALIASES);
        sense.registre = alias(sense.registre, {
          familier: 'familier',
          informal: 'familier',
          colloquial: 'familier',
          neutre: 'neutre',
          neutral: 'neutre',
          standard: 'neutre',
          soutenu: 'soutenu',
          formal: 'soutenu',
          argot: 'argot',
          slang: 'argot',
          vulgaire: 'vulgaire',
          vulgar: 'vulgaire',
        } as const);

        // Un équivalent unique arrive souvent sans tableau autour.
        if (typeof sense.equivalents === 'string') sense.equivalents = [sense.equivalents];
        if (Array.isArray(sense.equivalents)) {
          sense.equivalents = sense.equivalents
            .filter((word): word is string => typeof word === 'string' && word.trim().length > 0)
            .map((word) => word.trim())
            .slice(0, 4);
        }

        sense.precision = cleanNullableText(sense.precision);
        sense.exemple = cleanExample(sense.exemple);
        return sense;
      })
      .filter((sense) => Array.isArray(sense.equivalents) && sense.equivalents.length > 0)
      .slice(0, 6);
  }

  candidate.expressions = Array.isArray(candidate.expressions)
    ? candidate.expressions.map(cleanExample).filter(Boolean).slice(0, 5)
    : [];

  candidate.piege = cleanNullableText(candidate.piege);

  return candidate;
}
