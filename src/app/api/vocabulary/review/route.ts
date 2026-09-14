import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { recordReview } from '@/lib/vocabulary/repository';

const bodySchema = z.object({
  id: z.number().int().positive(),
  known: z.boolean(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();

  try {
    return NextResponse.json({ entry: recordReview(parsed.data.id, parsed.data.known) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
