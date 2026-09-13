import type { DictionaryEntry, DictionaryErrorCode } from './types';

export class DictionaryLookupError extends Error {
  constructor(readonly code: DictionaryErrorCode) {
    super(code);
    this.name = 'DictionaryLookupError';
  }
}

/** Recliquer sur un mot déjà consulté ne doit rien coûter ni rien attendre. */
const memory = new Map<string, DictionaryEntry>();

export async function lookupWord(word: string, signal?: AbortSignal): Promise<DictionaryEntry> {
  const key = word.toLowerCase();
  const cached = memory.get(key);
  if (cached) return cached;

  let response: Response;
  try {
    response = await fetch(`/api/dictionary/${encodeURIComponent(word)}`, { signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new DictionaryLookupError('network');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: DictionaryErrorCode;
    } | null;
    throw new DictionaryLookupError(body?.error ?? 'upstream');
  }

  const entry = (await response.json()) as DictionaryEntry;
  memory.set(key, entry);
  return entry;
}
