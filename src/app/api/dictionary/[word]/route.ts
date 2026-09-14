import { NextResponse } from 'next/server';
import { lookupDictionary } from '@/lib/dictionary/lookup';
import type { DictionaryEntry } from '@/lib/dictionary/types';

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

/** Plafond global : trois sources, chacune sur plusieurs formes candidates,
 *  dépasseraient sinon la minute pour un simple mot. */
const TOTAL_BUDGET_MS = 30_000;

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

  const result = await lookupDictionary(requested, {
    budget: AbortSignal.timeout(TOTAL_BUDGET_MS),
  });

  if (result.status === 'unavailable') {
    // Toutes les sources sont tombées : c'est passager, on ne met pas l'échec
    // en cache pour que le bouton « réessayer » ait un sens.
    console.error('[cuecard] dictionary upstream', requested, result.failures.join(' | '));
    return NextResponse.json({ error: 'upstream', word: requested }, { status: 502 });
  }

  if (result.status === 'not_found') {
    remember(key, 'not_found');
    return NextResponse.json({ error: 'not_found', word: requested }, { status: 404 });
  }

  remember(key, result.entry);
  return NextResponse.json(result.entry, {
    headers: { 'Cache-Control': `private, max-age=${ONE_WEEK_SECONDS}` },
  });
}
