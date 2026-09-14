import { optionalEnv } from '@/lib/env';
import type { DictionarySourceId } from '../types';
import { datamuseProvider } from './datamuse';
import { dictionaryApiProvider } from './dictionaryapi';
import { freeDictionaryProvider } from './freedictionary';
import type { DictionaryProvider } from './types';

export { ProviderUnavailableError } from './types';
export type { DictionaryProvider } from './types';

const REGISTRY: Record<DictionarySourceId, DictionaryProvider> = {
  freedictionary: freeDictionaryProvider,
  dictionaryapi: dictionaryApiProvider,
  datamuse: datamuseProvider,
};

/**
 * La plus fiable d'abord ; les suivantes ne servent que si elle tombe.
 * dictionaryapi.dev ferme la marche malgré son audio : c'est la seule des trois
 * à mettre une dizaine de secondes à répondre, et la faire passer avant Datamuse
 * ne ferait que ralentir les pannes.
 */
const DEFAULT_ORDER: readonly DictionarySourceId[] = [
  'freedictionary',
  'datamuse',
  'dictionaryapi',
];

function isSourceId(value: string): value is DictionarySourceId {
  return value in REGISTRY;
}

/**
 * L'ordre d'interrogation, surchargeable par `DICTIONARY_SOURCES` : une liste
 * d'identifiants séparés par des virgules. Un identifiant inconnu est ignoré
 * plutôt que fatal — une faute de frappe dans le .env ne doit pas priver
 * l'app de dictionnaire.
 */
export function resolveProviderOrder(
  raw = optionalEnv('DICTIONARY_SOURCES')
): DictionaryProvider[] {
  if (!raw) return DEFAULT_ORDER.map((id) => REGISTRY[id]);

  const requested = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(isSourceId);

  const ordered = [...new Set(requested)];
  return ordered.length > 0
    ? ordered.map((id) => REGISTRY[id])
    : DEFAULT_ORDER.map((id) => REGISTRY[id]);
}
