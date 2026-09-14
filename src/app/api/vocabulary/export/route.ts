import { errorResponse } from '@/lib/external/respond';
import { toAnkiCsv } from '@/lib/vocabulary/anki';
import { listEntries } from '@/lib/vocabulary/repository';

function fileName(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `cuecard-${today}.csv`;
}

export async function GET(request: Request) {
  const titleKey = new URL(request.url).searchParams.get('titleKey') ?? undefined;

  try {
    // Les plus anciens d'abord : un paquet Anki se lit dans l'ordre où on a
    // rencontré les mots, pas à l'envers.
    const entries = listEntries({ titleKey }).reverse();

    return new Response(toAnkiCsv(entries), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName()}"`,
      },
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}
