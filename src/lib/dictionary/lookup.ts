import { isFormPointerOnly } from './formOf';
import { candidateForms } from './lemma';
import { resolveProviderOrder, type DictionaryProvider } from './providers';
import type { DictionaryEntry } from './types';

export type LookupResult =
  | { status: 'found'; entry: DictionaryEntry }
  | { status: 'not_found' }
  | { status: 'unavailable'; failures: string[] };

export interface LookupOptions {
  /** Plafond global : une source lente ne doit pas faire attendre indéfiniment. */
  budget: AbortSignal;
  providers?: readonly DictionaryProvider[];
}

/**
 * Les sources de secours sont là pour les pannes, pas pour la couverture :
 * toutes les trois dérivent de Wiktionary et connaissent à peu près les mêmes
 * mots. Deux « inconnu » fermes suffisent donc à conclure, et un prénom tapé
 * par erreur ne fait plus attendre la source la plus lente jusqu'au bout.
 */
const MISS_CONFIRMATIONS = 2;

/** Le mot tapé dans la réplique reste affiché, même si c'est « wolf » qu'on a trouvé. */
function attribute(entry: DictionaryEntry, requested: string): DictionaryEntry {
  return { ...entry, requested };
}

/**
 * Interroge les sources dans l'ordre, chacune sur les formes candidates du
 * mot, et rend la première entrée qui dit vraiment quelque chose.
 *
 * Une source qui ne répond pas est abandonnée immédiatement : insister sur
 * ses autres formes ne ferait que repousser celle qui, elle, répond.
 */
export async function lookupDictionary(
  requested: string,
  { budget, providers = resolveProviderOrder() }: LookupOptions
): Promise<LookupResult> {
  const isPhrase = /\s/.test(requested.trim());
  const forms = candidateForms(requested);

  const failures: string[] = [];
  let confirmedMisses = 0;
  let pointer: DictionaryEntry | null = null;

  for (const provider of providers) {
    if (isPhrase && !provider.supportsPhrases) continue;

    let broke = false;
    for (const form of forms) {
      // Budget épuisé : on n'a pas de réponse ferme, seulement plus de temps.
      if (budget.aborted) {
        broke = true;
        break;
      }

      let entry: DictionaryEntry | null;
      try {
        entry = await provider.lookup(
          form,
          AbortSignal.any([budget, AbortSignal.timeout(provider.timeoutMs)])
        );
      } catch (cause) {
        failures.push(cause instanceof Error ? cause.message : String(cause));
        broke = true;
        break;
      }

      if (!entry) continue;
      if (!isFormPointerOnly(entry)) return { status: 'found', entry: attribute(entry, requested) };

      // « plural of wolf » : on garde le renvoi de côté et on tente la forme
      // de base, qui est la suivante dans la liste des candidates.
      pointer ??= attribute(entry, requested);
    }

    if (pointer) return { status: 'found', entry: pointer };

    if (!broke) {
      confirmedMisses += 1;
      if (confirmedMisses >= MISS_CONFIRMATIONS) break;
    }
  }

  if (confirmedMisses > 0) return { status: 'not_found' };
  return { status: 'unavailable', failures };
}
