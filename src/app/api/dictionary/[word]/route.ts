import { NextResponse } from 'next/server';
import { candidateForms } from '@/lib/dictionary/lemma';
import { normalizeDictionaryResponse } from '@/lib/dictionary/normalize';
import type { DictionaryEntry } from '@/lib/dictionary/types';

/** Surchargeable pour viser un miroir auto-hébergé de l'API : la publique
 *  limite le débit et tombe régulièrement. */
const UPSTREAM =
  process.env.DICTIONARY_API_URL ?? 'https://api.dictionaryapi.dev/api/v2/entries/en';
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;
const REQUEST_TIMEOUT_MS = 8000;

/** Un mot ne change pas de sens d'une séance à l'autre : on ne redemande pas. */
const cache = new Map<string, DictionaryEntry | 'not_found'>();
const MAX_CACHE_ENTRIES = 800;

const VALID_WORD = /^[\p{L}\p{N}'’ -]{1,60}$/u;

function remember(key: string, value: DictionaryEntry | 'not_found') {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

export async function GET(_request: Request, { params }: { params: Promise<{ word: string }> }) {
  const { word: rawWord } = await params;
  const requested = decodeURIComponent(rawWord).trim();

  if (!VALID_WORD.test(requested)) {
    return NextResponse.json({ error: 'not_found', word: requested }, { status: 400 });
  }

  const key = requested.toLowerCase();
  const cached = cache.get(key);
  if (cached) {
    return cached === 'not_found'
      ? NextResponse.json({ error: 'not_found', word: requested }, { status: 404 })
      : NextResponse.json(cached);
  }

  for (const candidate of candidateForms(requested)) {
    let response: Response;
    try {
      response = await fetch(`${UPSTREAM}/${encodeURIComponent(candidate)}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        next: { revalidate: ONE_WEEK_SECONDS },
      });
    } catch {
      // Le dictionnaire est injoignable : c'est temporaire, on ne met pas
      // l'échec en cache pour que le bouton « réessayer » ait un sens.
      return NextResponse.json({ error: 'upstream', word: requested }, { status: 502 });
    }

    if (response.status === 404) continue;

    if (!response.ok) {
      return NextResponse.json({ error: 'upstream', word: requested }, { status: 502 });
    }

    const entry = normalizeDictionaryResponse(await response.json().catch(() => null), requested);
    if (!entry) {
      return NextResponse.json({ error: 'invalid_response', word: requested }, { status: 502 });
    }

    remember(key, entry);
    return NextResponse.json(entry, {
      headers: { 'Cache-Control': `private, max-age=${ONE_WEEK_SECONDS}` },
    });
  }

  remember(key, 'not_found');
  return NextResponse.json({ error: 'not_found', word: requested }, { status: 404 });
}
