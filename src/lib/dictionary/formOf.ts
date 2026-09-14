import type { DictionaryEntry } from './types';

/**
 * Wiktionary donne à « wolves » une entrée qui ne dit que « plural of wolf ».
 * C'est une impasse quand on a tapé sur le mot dans une réplique : on veut la
 * définition, pas un renvoi. Repérer ces entrées permet d'aller chercher la
 * forme de base avant d'abandonner.
 *
 * Les tournures sont listées une à une, sans motif attrape-tout : « a form of
 * government » est une vraie définition, pas un renvoi.
 */
const POINTER_PHRASES: readonly RegExp[] = [
  /\b(?:plural|singular) of\b/i,
  /\bsimple past (?:and past participle )?of\b/i,
  /\bpast (?:tense|participle)(?: and past participle)? of\b/i,
  /\bpresent participle (?:and gerund )?of\b/i,
  /\bgerund of\b/i,
  /\b(?:comparative|superlative) (?:degree|form) of\b/i,
  /\b(?:first|second|third)-person\b[^.]{0,48}\bof\b/i,
  /\b(?:alternative|alternate|obsolete|archaic|dated|eye|nonstandard) (?:form|spelling) of\b/i,
  /\b(?:misspelling|abbreviation|initialism|contraction|inflection) of\b/i,
  /\b(?:genitive|dative|accusative|nominative|vocative) of\b/i,
];

export function isFormPointer(definition: string): boolean {
  return POINTER_PHRASES.some((phrase) => phrase.test(definition));
}

/** Vrai quand l'entrée entière ne fait que renvoyer vers d'autres formes. */
export function isFormPointerOnly(entry: DictionaryEntry): boolean {
  const definitions = entry.meanings.flatMap((meaning) => meaning.definitions);
  return (
    definitions.length > 0 && definitions.every((definition) => isFormPointer(definition.text))
  );
}
