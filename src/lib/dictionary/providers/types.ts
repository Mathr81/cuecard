import type { DictionaryEntry, DictionarySourceId } from '../types';

export interface DictionaryProvider {
  readonly id: DictionarySourceId;
  /** Une expression à plusieurs mots ne lui est envoyée que si c'est vrai. */
  readonly supportsPhrases: boolean;
  /** Au-delà, on passe à la source suivante : une source lente ne doit pas
   *  retenir celles qui répondent. */
  readonly timeoutMs: number;
  /**
   * `null` signifie « cette source ne connaît pas ce mot » : réponse ferme,
   * on peut interroger la suivante. Une exception signifie « cette source
   * n'a pas répondu » : c'est une panne, et le mot reste peut-être trouvable
   * ailleurs.
   */
  lookup(word: string, signal: AbortSignal): Promise<DictionaryEntry | null>;
}

/** Une panne de source, distincte d'un mot absent. */
export class ProviderUnavailableError extends Error {
  constructor(
    readonly provider: DictionarySourceId,
    readonly detail: string
  ) {
    super(`${provider}: ${detail}`);
    this.name = 'ProviderUnavailableError';
  }
}
