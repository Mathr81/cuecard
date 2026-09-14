import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/external/respond';
import { searchMulti } from '@/lib/tmdb/client';
import { tmdbLanguage } from '@/lib/tmdb/language';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return NextResponse.json({ results: [] });

  try {
    return NextResponse.json({
      results: await searchMulti(query, tmdbLanguage(url.searchParams.get('lang'))),
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}
