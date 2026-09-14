import { NextResponse } from 'next/server';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { getSeasonEpisodes } from '@/lib/tmdb/client';
import { tmdbLanguage } from '@/lib/tmdb/language';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; season: string }> }
) {
  const { id, season } = await params;
  const tmdbId = Number(id);
  const seasonNumber = Number(season);
  if (!Number.isInteger(tmdbId) || !Number.isInteger(seasonNumber)) return badRequest();

  const language = tmdbLanguage(new URL(request.url).searchParams.get('lang'));
  try {
    return NextResponse.json({ episodes: await getSeasonEpisodes(tmdbId, seasonNumber, language) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
