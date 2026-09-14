import { NextResponse } from 'next/server';
import { cacheSense, cachedSense } from '@/lib/db/repository';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { requestWordEntry, senseModel } from '@/lib/openrouter/client';
import { entryCacheKey, type WordEntryRequest } from '@/lib/sense/entryPrompt';
import { wordEntrySchema } from '@/lib/sense/entry';
import { contentLocale } from '@/i18n/content';
import { recordUsage } from '@/lib/usage/repository';

const EMPTY_USAGE = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

const VALID_TERM = /^[\p{L}\p{N}'’ -]{1,60}$/u;

export async function GET(_request: Request, { params }: { params: Promise<{ word: string }> }) {
  const { word } = await params;
  const term = decodeURIComponent(word).trim();
  if (!VALID_TERM.test(term)) return badRequest();

  const language = await contentLocale();
  const model = senseModel();
  const entryRequest: WordEntryRequest = { term, language };
  const cacheKey = entryCacheKey(entryRequest, model);

  try {
    // L'entrée générale ne dépend d'aucune scène : une fois payée, elle l'est
    // pour toujours, et pour tous les appareils puisque le cache est en base.
    const hit = wordEntrySchema.safeParse(cachedSense(cacheKey));
    if (hit.success) {
      recordUsage({ model, usage: EMPTY_USAGE, cached: true });
      return NextResponse.json({ entry: hit.data, usage: EMPTY_USAGE, model, cached: true });
    }

    const result = await requestWordEntry(entryRequest);
    recordUsage({ model: result.model, usage: result.usage, cached: false });
    cacheSense({
      cacheKey,
      term,
      language,
      model: result.model,
      payload: result.entry,
    });

    return NextResponse.json({
      entry: result.entry,
      usage: result.usage,
      model: result.model,
      cached: false,
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}
