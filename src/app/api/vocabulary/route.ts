import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { deleteEntry, listEntries, saveEntry } from '@/lib/vocabulary/repository';

const bodySchema = z.object({
  term: z.string().min(1).max(120),
  cueText: z.string().min(1).max(1000),
  titleKey: z.string().min(1).max(200),
  titleName: z.string().min(1).max(300),
  episodeLabel: z.string().max(20).nullable().default(null),
  startMs: z.number().int().nonnegative(),
  translation: z.string().max(300).nullable().default(null),
  explanation: z.string().max(700).nullable().default(null),
  register: z.string().max(40).nullable().default(null),
  kind: z.string().max(40).nullable().default(null),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  try {
    return NextResponse.json({
      entries: listEntries({
        query: params.get('q') ?? undefined,
        titleKey: params.get('titleKey') ?? undefined,
      }),
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();

  try {
    return NextResponse.json({ entry: saveEntry(parsed.data) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return badRequest();

  try {
    deleteEntry(id);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return errorResponse(cause);
  }
}
