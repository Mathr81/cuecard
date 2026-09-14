import { NextResponse } from 'next/server';
import { forgetTitle, recentTitles } from '@/lib/db/repository';
import { badRequest, errorResponse } from '@/lib/external/respond';

export async function GET() {
  try {
    return NextResponse.json({ titles: recentTitles() });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function DELETE(request: Request) {
  const key = new URL(request.url).searchParams.get('key');
  if (!key) return badRequest();

  try {
    forgetTitle(key);
    return NextResponse.json({ titles: recentTitles() });
  } catch (cause) {
    return errorResponse(cause);
  }
}
