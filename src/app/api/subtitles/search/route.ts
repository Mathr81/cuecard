import { NextResponse } from 'next/server';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { searchSubtitles } from '@/lib/opensubtitles/client';
import { titleRefSchema } from '@/lib/titles/schema';

export async function POST(request: Request) {
  const parsed = titleRefSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();

  try {
    return NextResponse.json({ candidates: await searchSubtitles(parsed.data) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
