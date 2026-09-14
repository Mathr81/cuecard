import { createHash } from 'node:crypto';
import { REGISTERS, SENSE_TYPES } from './schema';

export type SenseLanguage = 'fr' | 'en';

export interface SenseRequest {
  /** Le mot ou l'expression sélectionnée. */
  term: string;
  /** Les répliques du contexte, dans l'ordre. */
  lines: string[];
  /** Position de la réplique courante dans `lines`. */
  targetIndex: number;
  title: string;
  year: number | null;
  genres: string[];
  language: SenseLanguage;
}

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

const LANGUAGE_NAME: Record<SenseLanguage, string> = {
  fr: 'French',
  en: 'English',
};

export function buildMessages(request: SenseRequest): ChatMessage[] {
  const language = LANGUAGE_NAME[request.language];

  const system = [
    'You are a precise bilingual lexicographer helping a French high-school student',
    'understand English dialogue from films and series.',
    'Answer with a single JSON object and nothing else: no markdown fence, no prose.',
    '',
    'Required shape:',
    '{',
    '  "traduction_contextuelle": string,',
    '  "explication": string,',
    `  "registre": ${REGISTERS.map((value) => JSON.stringify(value)).join(' | ')},`,
    `  "type": ${SENSE_TYPES.map((value) => JSON.stringify(value)).join(' | ')},`,
    '  "note_culturelle": string | null,',
    '  "exemples": [{ "en": string, "fr": string }]',
    '}',
    '',
    'Rules:',
    `- Write "traduction_contextuelle", "explication", "note_culturelle" and the "fr" field in ${language}.`,
    '- "traduction_contextuelle" is what the expression means HERE, in this scene. Never the',
    '  generic dictionary sense when the scene narrows it.',
    '- "explication" is at most two sentences saying why it means that here.',
    '- "registre" and "type" must be one of the listed values, spelled exactly as listed.',
    '- "note_culturelle" is null unless a reference genuinely needs unpacking.',
    '- "exemples": one to three short, natural examples. "en" is English, "fr" is its',
    `  translation in ${language}.`,
  ].join('\n');

  const context = request.lines
    .map((line, index) => {
      // Le repère marque la réplique à expliquer : sans lui, le modèle choisit
      // souvent la mauvaise occurrence quand le mot revient dans la scène.
      const marker = index === request.targetIndex ? '>>' : '  ';
      return `${marker} ${line.replace(/\n/g, ' ')}`;
    })
    .join('\n');

  const heading = [request.title, request.year ? `(${request.year})` : null]
    .filter(Boolean)
    .join(' ');

  const user = [
    `TITLE: ${heading}`,
    request.genres.length > 0 ? `GENRES: ${request.genres.join(', ')}` : null,
    '',
    'SCENE (subtitle lines, the one to explain is marked >>):',
    context,
    '',
    `EXPRESSION TO EXPLAIN: ${JSON.stringify(request.term)}`,
  ]
    .filter((part) => part !== null)
    .join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Clé de cache : le même mot dans la même scène, dans la même langue et avec
 * le même modèle donne la même explication. Recliquer ne doit rien coûter.
 */
export function senseCacheKey(request: SenseRequest, model: string): string {
  const material = JSON.stringify([
    request.term.toLowerCase(),
    request.lines,
    request.targetIndex,
    request.title,
    request.genres,
    request.language,
    model,
  ]);
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}
