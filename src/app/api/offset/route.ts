import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clearOffset, readOffset, writeOffset } from '@/lib/db/repository';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { MAX_OFFSET_MS } from '@/lib/subtitles/offset';

const bodySchema = z.object({
  titleKey: z.string().min(1).max(200),
  fileId: z.string().min(1).max(100),
  offsetMs: z.number().int().min(-MAX_OFFSET_MS).max(MAX_OFFSET_MS),
});

function target(request: Request): { titleKey: string; fileId: string } | null {
  const params = new URL(request.url).searchParams;
  const titleKey = params.get('titleKey');
  const fileId = params.get('fileId');
  return titleKey && fileId ? { titleKey, fileId } : null;
}

export async function GET(request: Request) {
  const where = target(request);
  if (!where) return badRequest();

  try {
    return NextResponse.json({ offsetMs: readOffset(where.titleKey, where.fileId) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function PUT(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();

  try {
    writeOffset(parsed.data.titleKey, parsed.data.fileId, parsed.data.offsetMs);
    return NextResponse.json({ offsetMs: parsed.data.offsetMs });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function DELETE(request: Request) {
  const where = target(request);
  if (!where) return badRequest();

  try {
    clearOffset(where.titleKey, where.fileId);
    return NextResponse.json({ offsetMs: null });
  } catch (cause) {
    return errorResponse(cause);
  }
}
