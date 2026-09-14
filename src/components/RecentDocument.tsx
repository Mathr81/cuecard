'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { ICON, X, iconProps } from '@/components/icons';
import { useSubtitleStore } from '@/store/subtitles';

/**
 * Un fichier chargé à la main n'a pas d'entrée dans l'historique des titres :
 * c'est la seule session qui a besoin de sa propre carte pour être reprise.
 */
export function RecentDocument() {
  const t = useTranslations('home');
  const format = useFormatter();
  const doc = useSubtitleStore((state) => state.document);
  const hydrated = useSubtitleStore((state) => state.hydrated);
  const clearDocument = useSubtitleStore((state) => state.clearDocument);

  if (!hydrated || !doc || doc.source !== 'upload') return null;

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/reader"
        className="press flex min-h-20 min-w-0 flex-1 flex-col justify-center rounded-xl bg-surface px-4 py-3"
      >
        <span className="truncate text-base font-semibold text-ink">{doc.name}</span>
        <span className="mt-1 truncate text-sm text-dim">
          {t('cuesCount', { count: doc.cues.length })} ·{' '}
          {t('openedAt', { date: format.dateTime(doc.loadedAt, { dateStyle: 'short' }) })}
        </span>
      </Link>
      <button
        type="button"
        onClick={clearDocument}
        aria-label={t('remove')}
        className="press flex size-11 shrink-0 items-center justify-center rounded-xl text-dim"
      >
        <X size={ICON} {...iconProps} />
      </button>
    </div>
  );
}
