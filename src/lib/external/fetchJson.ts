import { codeForStatus, ExternalApiError } from './errors';

const DEFAULT_TIMEOUT_MS = 12_000;

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  } catch (cause) {
    throw new ExternalApiError('network', cause instanceof Error ? cause.message : undefined);
  }

  if (!response.ok) {
    // Le corps d'erreur porte souvent le vrai motif (quota, clé invalide) :
    // il vaut mieux le remonter que de n'afficher qu'un code HTTP.
    const detail = await response.text().catch(() => '');
    throw new ExternalApiError(codeForStatus(response.status), detail.slice(0, 300));
  }

  return (await response.json()) as T;
}
