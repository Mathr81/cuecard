import { createHash } from 'node:crypto';
import { ENTRY_PARTS } from './entry';
import { REGISTERS } from './schema';
import type { ChatMessage, SenseLanguage } from './prompt';

export interface WordEntryRequest {
  /** Le mot ou l'expression, sans son contexte : c'est tout l'intérêt. */
  term: string;
  language: SenseLanguage;
}

const LANGUAGE_NAME: Record<SenseLanguage, string> = { fr: 'French', en: 'English' };

export function buildEntryMessages(request: WordEntryRequest): ChatMessage[] {
  const language = LANGUAGE_NAME[request.language];

  const system = [
    `You are a bilingual English to ${language} lexicographer writing a dictionary entry`,
    'for a French high-school student who meets English words in films and series.',
    'Answer with a single JSON object and nothing else: no markdown fence, no prose.',
    '',
    'Required shape:',
    '{',
    '  "traductions": [',
    '    {',
    `      "nature": ${ENTRY_PARTS.map((value) => JSON.stringify(value)).join(' | ')},`,
    `      "equivalents": [string],`,
    '      "precision": string | null,',
    `      "registre": ${REGISTERS.map((value) => JSON.stringify(value)).join(' | ')},`,
    '      "exemple": { "en": string, "fr": string } | null',
    '    }',
    '  ],',
    '  "expressions": [{ "en": string, "fr": string }],',
    '  "piege": string | null',
    '}',
    '',
    'Rules:',
    '- This is the GENERAL entry for the word, the one you would revise on a flashcard.',
    '  Never the meaning in one particular sentence.',
    `- "equivalents" holds one to four ${language} equivalents for that sense, the most`,
    '  natural one first. Single words or short phrases, never a definition.',
    '- Order "traductions" by how often the sense is actually heard in contemporary',
    '  spoken English. The sense a viewer will meet tonight comes first; archaic,',
    '  technical and regional senses come last or not at all. At most six.',
    `- "precision" tells apart two senses that could be confused, in ${language},`,
    '  in a few words ("when talking about a person", "only about food"). null when',
    '  the equivalents already speak for themselves.',
    '- "registre" and "nature" must be one of the listed values, spelled exactly as listed.',
    `- "exemple" is one short, natural sentence for that sense, with its ${language}`,
    '  translation. null rather than a laboured example.',
    '- "expressions": the set phrases, phrasal verbs and idioms built on this word that',
    '  a viewer really runs into. "en" is the English expression, "fr" is what it means',
    `  in ${language}. Up to five, most common first, empty when there are none.`,
    `- "piege" warns, in ${language}, about a false friend or a mistake French speakers`,
    '  genuinely make with this word. null unless there is a real one. Do not invent one.',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: `WORD: ${JSON.stringify(request.term)}` },
  ];
}

/**
 * Clé de cache : l'entrée générale ne dépend ni de la scène ni du film, donc
 * un mot n'est payé qu'une fois pour toutes, et le cache profite à tous les
 * appareils puisqu'il est en base.
 */
export function entryCacheKey(request: WordEntryRequest, model: string): string {
  const material = JSON.stringify(['entry', request.term.toLowerCase(), request.language, model]);
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}
