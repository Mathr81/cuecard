import { NextResponse } from 'next/server';
import { envOr } from '@/lib/env';
import { candidateForms } from '@/lib/dictionary/lemma';
import { normalizeDictionaryResponse } from '@/lib/dictionary/normalize';
import type { DictionaryEntry } from '@/lib/dictionary/types';

/** Surchargeable pour viser un miroir auto-hébergé de l'API : la publique
 *  limite le débit et tombe régulièrement. */
const UPSTREAM = envOr('DICTIONARY_API_URL', 'https://api.dictionaryapi.dev/api/v2/entries/en');
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

/** L'API publique met couramment vingt secondes à répondre : huit ne suffisent
 *  pas, et tout appel se soldait par une panne. */
const REQUEST_TIMEOUT_MS = 15_000;

/** Elle renvoie aussi des 5xx passagers — un 522 sur un mot, un 200 sur le
 *  suivant. Une seule reprise, parce qu'elle suffit et qu'insister ferait
 *  attendre pour rien. */
const RETRY_DELAY_MS = 400;

/** Plafond global : quatre formes candidates, chacune avec sa reprise,
 *  dépasseraient sinon la minute pour un simple mot. */
const TOTAL_BUDGET_MS = 30_000;

/** Un mot ne change pas de sens d'une séance à l'autre : on ne redemande pas. */
const cache = new Map<string, DictionaryEntry | 'not_found'>();
const MAX_CACHE_ENTRIES = 800;

const VALID_WORD = /^[\p{L}\p{N}'’ -]{1,60}$/u;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Un aller-retour vers l'API, avec une reprise sur panne serveur. Un 404 et
 * un succès sont des réponses définitives : on ne les rejoue pas.
 */
async function fetchWord(word: string, budget: AbortSignal): Promise<Response> {
  const url = `${UPSTREAM}/${encodeURIComponent(word)}`;

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      signal: AbortSignal.any([budget, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      next: { revalidate: ONE_WEEK_SECONDS },
    });

    if (response.ok || response.status === 404 || attempt > 0 || response.status < 500) {
      return response;
    }
    await delay(RETRY_DELAY_MS);
  }
}

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

  const budget = AbortSignal.timeout(TOTAL_BUDGET_MS);

  for (const candidate of candidateForms(requested)) {
    let response: Response;
    try {
      response = await fetchWord(candidate, budget);
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
