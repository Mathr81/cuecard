import { NextResponse } from 'next/server';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { getMovie } from '@/lib/tmdb/client';
import { tmdbLanguage } from '@/lib/tmdb/language';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tmdbId = Number(id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return badRequest();

  const language = tmdbLanguage(new URL(request.url).searchParams.get('lang'));
  try {
    return NextResponse.json(await getMovie(tmdbId, language));
  } catch (cause) {
    return errorResponse(cause);
  }
}
