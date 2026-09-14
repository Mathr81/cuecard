import 'server-only';
import type { ModelPricing } from './cost';

const MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models';

/** Les tarifs bougent peu ; une fois par jour suffit largement. */
const ONE_DAY_SECONDS = 60 * 60 * 24;
const REQUEST_TIMEOUT_MS = 10_000;

interface RawModel {
  id?: unknown;
  name?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown };
}

function toPrice(value: unknown): number | null {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

export type { ModelPricing };

export function findPricing(payload: unknown, model: string): ModelPricing | null {
  const models = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(models)) return null;

  const found = (models as RawModel[]).find((entry) => entry?.id === model);
  if (!found) return null;

  const prompt = toPrice(found.pricing?.prompt);
  const completion = toPrice(found.pricing?.completion);
  if (prompt === null || completion === null) return null;

  return {
    model,
    displayName: typeof found.name === 'string' && found.name ? found.name : model,
    promptUsdPerToken: prompt,
    completionUsdPerToken: completion,
  };
}

/**
 * Le tarif du modèle en cours. `null` veut dire quelque chose : OpenRouter
 * retire les modèles obsolètes de sa liste, donc un identifiant introuvable
 * est presque toujours un modèle qui n'existe plus, et les appels échoueront.
 * L'endpoint est public, aucune clé n'est nécessaire.
 */
export async function modelPricing(model: string): Promise<ModelPricing | null> {
  try {
    const response = await fetch(MODELS_ENDPOINT, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: ONE_DAY_SECONDS },
    });
    if (!response.ok) return null;

    return findPricing(await response.json(), model);
  } catch {
    // Pas de tarif, pas de drame : le compteur de jetons reste affiché.
    return null;
  }
}
