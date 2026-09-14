import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cacheSubtitleFile, cachedSubtitleFile, rememberTitle } from '@/lib/db/repository';
import { badRequest, errorResponse } from '@/lib/external/respond';
import { downloadSubtitleFile, requestDownload } from '@/lib/opensubtitles/client';
import { decodeSubtitleBuffer } from '@/lib/subtitles/decode';
import { parseSubtitles } from '@/lib/subtitles/parse';
import { episodeLabel, titleKey } from '@/lib/titles/key';
import { titleRefSchema } from '@/lib/titles/schema';
import type { SubtitleDocument } from '@/lib/subtitles/types';
import type { TitleRef } from '@/lib/titles/types';

const bodySchema = z.object({
  title: titleRefSchema,
  fileId: z.number().int().positive(),
  releaseName: z.string().max(300).default('—'),
});

function describe(title: TitleRef, releaseName: string): string {
  const label = episodeLabel(title);
  const episodePart = [label, title.episodeName].filter(Boolean).join(' · ');
  return episodePart || releaseName;
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const { title, fileId, releaseName } = parsed.data;
  const key = titleKey(title);

  try {
    // Le quota journalier de téléchargements est la ressource rare : un
    // fichier déjà récupéré ne l'est jamais une seconde fois.
    let cached = cachedSubtitleFile(fileId);

    if (!cached) {
      const ticket = await requestDownload(fileId);
      const buffer = await downloadSubtitleFile(ticket.link);
      const { text, encoding } = decodeSubtitleBuffer(buffer);
      const { cues, format } = parseSubtitles(text);

      if (cues.length === 0) return errorResponse(new Error('empty subtitle file'));

      cached = {
        fileId,
        titleKey: key,
        releaseName,
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
      id: `${key}#${fileId}`,
      titleKey: key,
      fileId: String(fileId),
      name: title.name,
      subtitle: describe(title, cached.releaseName),
      source: 'opensubtitles',
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
