import { z } from 'zod';

export const REGISTERS = ['familier', 'neutre', 'soutenu', 'argot', 'vulgaire'] as const;

export const SENSE_TYPES = [
  'littéral',
  'idiome',
  'phrasal verb',
  'référence culturelle',
  'jeu de mots',
] as const;

export const senseSchema = z.object({
  /** Le sens précis ICI, pas l'entrée de dictionnaire. */
  traduction_contextuelle: z.string().min(1).max(300),
  explication: z.string().min(1).max(700),
  registre: z.enum(REGISTERS),
  type: z.enum(SENSE_TYPES),
  note_culturelle: z.string().max(700).nullable(),
  /** `fr` porte la traduction dans la langue de sortie choisie, pas forcément
   *  du français : les clés du contrat sont fixes, la langue ne l'est pas. */
  exemples: z.array(z.object({ en: z.string().min(1).max(300), fr: z.string().min(1).max(300) })),
});

export type ContextualSense = z.infer<typeof senseSchema>;

function plain(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Les modèles répondent « informal », « litteral » ou « Idiom » : ce sont les
 *  mêmes valeurs, les refuser ne ferait que payer une relance pour rien. */
const REGISTER_ALIASES: Record<string, (typeof REGISTERS)[number]> = {
  familier: 'familier',
  informal: 'familier',
  colloquial: 'familier',
  casual: 'familier',
  neutre: 'neutre',
  neutral: 'neutre',
  standard: 'neutre',
  soutenu: 'soutenu',
  formal: 'soutenu',
  literary: 'soutenu',
  argot: 'argot',
  slang: 'argot',
  vulgaire: 'vulgaire',
  vulgar: 'vulgaire',
  crude: 'vulgaire',
  offensive: 'vulgaire',
};

const TYPE_ALIASES: Record<string, (typeof SENSE_TYPES)[number]> = {
  litteral: 'littéral',
  literal: 'littéral',
  idiome: 'idiome',
  idiom: 'idiome',
  idiomatic: 'idiome',
  'phrasal verb': 'phrasal verb',
  'verbe a particule': 'phrasal verb',
  'reference culturelle': 'référence culturelle',
  'cultural reference': 'référence culturelle',
  'jeu de mots': 'jeu de mots',
  pun: 'jeu de mots',
  wordplay: 'jeu de mots',
  'play on words': 'jeu de mots',
};

function alias<T extends string>(value: unknown, table: Record<string, T>): unknown {
  return typeof value === 'string' ? (table[plain(value)] ?? value) : value;
}

/**
 * Rapproche une réponse presque conforme du contrat avant de la valider :
 * une relance coûte une seconde d'attente et des jetons, autant l'éviter
 * quand la seule faute est un accent ou un synonyme anglais.
 */
export function normalizeSenseCandidate(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const candidate = { ...(value as Record<string, unknown>) };

  candidate.registre = alias(candidate.registre, REGISTER_ALIASES);
  candidate.type = alias(candidate.type, TYPE_ALIASES);

  // « null », « none » ou une chaîne vide veulent tous dire « rien à signaler ».
  if (typeof candidate.note_culturelle === 'string') {
    const note = candidate.note_culturelle.trim();
    candidate.note_culturelle =
      note === '' || plain(note) === 'null' || plain(note) === 'none' ? null : note;
  }
  candidate.note_culturelle = candidate.note_culturelle ?? null;

  if (Array.isArray(candidate.exemples)) {
    candidate.exemples = candidate.exemples
      .filter(
        (item): item is { en: string; fr: string } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as { en?: unknown }).en === 'string' &&
          typeof (item as { fr?: unknown }).fr === 'string' &&
          (item as { en: string }).en.trim().length > 0 &&
          (item as { fr: string }).fr.trim().length > 0
      )
      .slice(0, 3);
  } else {
    candidate.exemples = [];
  }

  return candidate;
}

/** Extrait l'objet JSON d'une réponse qui l'a emballé dans du markdown. */
export function extractJsonObject(content: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  const raw = (fenced?.[1] ?? content).trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}
