import { NextResponse } from 'next/server';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { findEntry } from '@/lib/vocabulary/repository';

/** Le bouton « sauvegarder » doit savoir, à l'ouverture de la feuille, si ce
 *  mot est déjà dans le carnet : sinon il ment une fois sur deux. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const term = params.get('term');
  const titleKey = params.get('titleKey');
  const startMs = Number(params.get('startMs'));

  if (!term || !titleKey || !Number.isInteger(startMs)) return badRequest();

  try {
    return NextResponse.json({ entry: findEntry(term, titleKey, startMs) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
