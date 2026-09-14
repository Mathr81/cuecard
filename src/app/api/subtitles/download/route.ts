import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cacheSubtitleFile, cachedSubtitleFile, rememberTitle } from '@/lib/db/repository';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { ExternalApiError } from '@/lib/external/errors';
import { decodeSubtitleBuffer } from '@/lib/subtitles/decode';
import { parseSubtitles } from '@/lib/subtitles/parse';
import { downloadCandidate } from '@/lib/subtitles/providers';
import { episodeLabel, titleKey } from '@/lib/titles/key';
import { titleRefSchema } from '@/lib/titles/schema';
import type { SubtitleDocument } from '@/lib/subtitles/types';
import type { TitleRef } from '@/lib/titles/types';

const candidateSchema = z.object({
  id: z.string().min(1).max(200),
  provider: z.enum(['opensubtitles', 'shegu']),
  releaseName: z.string().max(300).default('-'),
  url: z.url().max(2000),
  format: z.enum(['srt', 'vtt']),
  encoding: z.enum(['gzip', 'plain']),
  downloadCount: z.number().int().nullable().default(null),
});

const bodySchema = z.object({
  title: titleRefSchema,
  candidate: candidateSchema,
});

function describe(title: TitleRef, releaseName: string): string {
  const label = episodeLabel(title);
  const episodePart = [label, title.episodeName].filter(Boolean).join(' · ');
  return episodePart || releaseName;
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const { title, candidate } = parsed.data;
  const key = titleKey(title);

  try {
    // Un fichier déjà récupéré ne l'est pas une seconde fois : c'est autant de
    // moins à demander à des services qu'on ne paie pas.
    let cached = cachedSubtitleFile(candidate.id);

    if (!cached) {
      const buffer = await downloadCandidate(candidate);
      const { text, encoding } = decodeSubtitleBuffer(buffer);
      const { cues, format } = parseSubtitles(text);

      if (cues.length === 0) {
        throw new ExternalApiError('invalid_response', 'no readable cue in the downloaded file');
      }

      cached = {
        fileId: candidate.id,
        titleKey: key,
        releaseName: candidate.releaseName,
        content: text,
        encoding,
        format,
        cueCount: cues.length,
        fetchedAt: Date.now(),
      };
      cacheSubtitleFile(cached);
    }

    const { cues, format } = parseSubtitles(cached.content);
    rememberTitle(title);

    const document: SubtitleDocument = {
      id: `${key}#${candidate.id}`,
      titleKey: key,
      fileId: candidate.id,
      name: title.name,
      subtitle: describe(title, cached.releaseName),
      source: candidate.provider,
      releaseName: cached.releaseName,
      encoding: cached.encoding,
      format,
      cues,
      loadedAt: Date.now(),
      title,
    };

    return NextResponse.json({ document });
  } catch (cause) {
    return errorResponse(cause);
  }
}
