import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cacheSense, cachedSense } from '@/lib/db/repository';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { requestSense, senseModel } from '@/lib/openrouter/client';
import { senseCacheKey, type SenseRequest } from '@/lib/sense/prompt';
import { senseSchema } from '@/lib/sense/schema';
import { contentLocale } from '@/i18n/content';
import { recordUsage } from '@/lib/usage/repository';

const EMPTY_USAGE = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

const bodySchema = z.object({
  term: z.string().min(1).max(120),
  lines: z.array(z.string().max(500)).min(1).max(15),
  targetIndex: z.number().int().nonnegative(),
  title: z.string().max(300).default(''),
  year: z.number().int().nullable().default(null),
  genres: z.array(z.string().max(60)).max(10).default([]),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.targetIndex >= parsed.data.lines.length) return badRequest();

  const language = await contentLocale();
  const senseRequest: SenseRequest = { ...parsed.data, language };
  const model = senseModel();
  const cacheKey = senseCacheKey(senseRequest, model);

  try {
    // Recliquer sur un mot déjà expliqué ne doit rien coûter ni rien attendre.
    const hit = senseSchema.safeParse(cachedSense(cacheKey));
    if (hit.success) {
      // Compté aussi, à zéro jeton : c'est ce que le cache fait gagner.
      recordUsage({ model, usage: EMPTY_USAGE, cached: true });
      return NextResponse.json({
        sense: hit.data,
        usage: EMPTY_USAGE,
        model,
        cached: true,
      });
    }

    const result = await requestSense(senseRequest);
    recordUsage({ model: result.model, usage: result.usage, cached: false });
    cacheSense({
      cacheKey,
      term: senseRequest.term,
      language,
      model: result.model,
      payload: result.sense,
    });

    return NextResponse.json({
      sense: result.sense,
      usage: result.usage,
      model: result.model,
      cached: false,
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}
