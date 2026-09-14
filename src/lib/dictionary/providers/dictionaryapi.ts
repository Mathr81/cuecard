import { envOr } from '@/lib/env';
import { normalizeDictionaryResponse } from '../normalize';
import { ProviderUnavailableError, type DictionaryProvider } from './types';

/**
 * api.dictionaryapi.dev : la source historique de l'app. Elle est la seule à
 * fournir un enregistrement audio, mais elle met une vingtaine de secondes à
 * répondre et renvoie régulièrement des 5xx, d'où son rang de remplaçante.
 * Surchargeable pour viser un miroir auto-hébergé.
 */
const BASE_URL = envOr('DICTIONARY_API_URL', 'https://api.dictionaryapi.dev/api/v2/entries/en');

export const dictionaryApiProvider: DictionaryProvider = {
  id: 'dictionaryapi',
  // Elle n'indexe que des mots seuls : lui envoyer "pull off" ne donne rien.
  supportsPhrases: false,
  timeoutMs: 10_000,

  async lookup(word, signal) {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/${encodeURIComponent(word)}`, {
        signal,
        headers: { Accept: 'application/json' },
      });
    } catch (cause) {
      throw new ProviderUnavailableError('dictionaryapi', String(cause));
    }

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new ProviderUnavailableError('dictionaryapi', `HTTP ${response.status}`);
    }

    const entry = normalizeDictionaryResponse(await response.json().catch(() => null), word);
    if (!entry) throw new ProviderUnavailableError('dictionaryapi', 'réponse inattendue');
    return entry;
  },
};
