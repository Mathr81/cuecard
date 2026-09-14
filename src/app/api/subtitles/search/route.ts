import { NextResponse } from 'next/server';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { searchSubtitles } from '@/lib/subtitles/providers';
import { titleRefSchema } from '@/lib/titles/schema';

export async function POST(request: Request) {
  const parsed = titleRefSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const title = parsed.data;
  try {
    return NextResponse.json(
      await searchSubtitles({
        mediaType: title.mediaType,
        tmdbId: title.tmdbId,
        imdbId: title.imdbId,
        season: title.season,
        episode: title.episode,
      })
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}
