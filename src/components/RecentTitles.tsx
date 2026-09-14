'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TitlePoster } from '@/components/TitlePoster';
import { apiGet, apiSend } from '@/lib/api/client';
import { episodeLabel, titleKey } from '@/lib/titles/key';
import type { RecentTitle } from '@/lib/titles/types';
import { useSubtitleStore } from '@/store/subtitles';

/** Je regarde souvent plusieurs épisodes d'affilée : retaper le titre à chaque
 *  fois n'a aucun sens. */
export function RecentTitles() {
  const t = useTranslations('titles');
  const [titles, setTitles] = useState<RecentTitle[] | null>(null);
  // Le titre déjà chargé se reprend directement dans le lecteur, sans
  // redemander les sous-titres ni consommer de quota.
  const openedKey = useSubtitleStore((state) => state.document?.titleKey ?? null);

  useEffect(() => {
    const controller = new AbortController();

    apiGet<{ titles: RecentTitle[] }>('/api/history', controller.signal)
      .then((data) => setTitles(data.titles))
      // L'historique est un confort : son échec ne doit rien bloquer.
      .catch(() => {
        if (!controller.signal.aborted) setTitles([]);
      });

    return () => controller.abort();
  }, []);

  async function forget(key: string) {
    setTitles((current) => current?.filter((title) => titleKey(title) !== key) ?? null);
    await apiSend<{ titles: RecentTitle[] }>(
      `/api/history?key=${encodeURIComponent(key)}`,
      'DELETE'
    ).catch(() => undefined);
  }

  if (titles === null) return <div className="h-20 animate-pulse rounded-2xl bg-surface" />;
  if (titles.length === 0) return <p className="px-1 text-sm text-dim">{t('historyEmpty')}</p>;

  return (
    <ul className="flex flex-col gap-2">
      {titles.map((title) => {
        const key = titleKey(title);
        const label = episodeLabel(title);
        const opened = key === openedKey;

        return (
          <li key={key} className="flex items-stretch gap-2">
            <Link
              href={
                opened
                  ? '/reader'
                  : title.mediaType === 'tv' && title.season !== null
                    ? `/title/tv/${title.tmdbId}?season=${title.season}&episode=${title.episode}`
                    : `/title/${title.mediaType}/${title.tmdbId}`
              }
              className="flex min-h-20 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line bg-surface p-2 pr-4 active:bg-surface-high"
            >
              <TitlePoster path={title.posterPath} alt={title.name} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-base font-semibold text-ink">{title.name}</span>
                  {opened ? (
                    <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">
                      {t('opened')}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-sm text-muted">
                  {[label, title.episodeName ?? title.year].filter(Boolean).join(' · ')}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void forget(key)}
              aria-label={t('forget')}
              className="w-12 shrink-0 rounded-2xl border border-line bg-surface text-xl text-muted"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
