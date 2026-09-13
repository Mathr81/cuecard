'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useSubtitleStore } from '@/store/subtitles';

export function RecentDocument() {
  const t = useTranslations('home');
  const format = useFormatter();
  const doc = useSubtitleStore((state) => state.document);
  const hydrated = useSubtitleStore((state) => state.hydrated);
  const clearDocument = useSubtitleStore((state) => state.clearDocument);

  if (!hydrated) return <div className="h-24 animate-pulse rounded-2xl bg-surface" />;

  if (!doc) {
    return <p className="px-1 text-sm text-dim">{t('recentEmpty')}</p>;
  }

  return (
    <div className="flex items-stretch gap-2">
      <Link
        href="/reader"
        className="flex min-h-16 flex-1 flex-col justify-center rounded-2xl border border-line bg-surface px-4 py-3"
      >
        <span className="truncate text-base font-semibold text-ink">{doc.name}</span>
        <span className="mt-0.5 text-sm text-muted">
          {t('cuesCount', { count: doc.cues.length })} ·{' '}
          {t('openedAt', {
            date: format.dateTime(doc.loadedAt, { dateStyle: 'short', timeStyle: 'short' }),
          })}
        </span>
      </Link>
      <button
        type="button"
        onClick={clearDocument}
        aria-label={t('remove')}
        className="min-h-16 w-14 shrink-0 rounded-2xl border border-line bg-surface text-xl text-muted"
      >
        ×
      </button>
    </div>
  );
}
