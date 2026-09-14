'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { HighlightedText } from '@/components/HighlightedText';
import { apiGet, apiSend } from '@/lib/api/client';
import { formatTimestamp } from '@/lib/time';
import { reviewOrder } from '@/lib/vocabulary/sort';
import type { VocabularyEntry } from '@/lib/vocabulary/types';

interface Progress {
  known: number;
  unknown: number;
}

/**
 * Une carte à la fois, la phrase du film comme contexte, révéler, marquer.
 * Pas de SM-2 : l'ordre suffit, et je sais quand j'ai besoin de revoir un mot.
 */
export function ReviewSession() {
  const t = useTranslations('vocabulary');
  const [queue, setQueue] = useState<VocabularyEntry[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [progress, setProgress] = useState<Progress>({ known: 0, unknown: 0 });

  useEffect(() => {
    const controller = new AbortController();
    apiGet<{ entries: VocabularyEntry[] }>('/api/vocabulary', controller.signal)
      // L'ordre est figé au démarrage : une carte ne doit pas ressurgir au
      // milieu de la session parce qu'on vient de la rater.
      .then((data) => setQueue([...data.entries].sort(reviewOrder)))
      .catch(() => {
        // Réviser sans le carnet n'a pas de sens : mieux vaut le dire que
        // d'annoncer une session vide.
        if (!controller.signal.aborted) setUnreachable(true);
      });
    return () => controller.abort();
  }, []);

  function answer(entry: VocabularyEntry, known: boolean) {
    setProgress((current) => ({
      known: current.known + (known ? 1 : 0),
      unknown: current.unknown + (known ? 0 : 1),
    }));
    setRevealed(false);
    setPosition((current) => current + 1);
    void apiSend('/api/vocabulary/review', 'POST', { id: entry.id, known }).catch(() => undefined);
  }

  if (unreachable) {
    return (
      <Centered>
        <p className="text-base font-semibold text-ink">{t('unreachable')}</p>
        <p className="text-sm leading-relaxed text-muted">{t('unreachableHint')}</p>
      </Centered>
    );
  }

  if (queue === null) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface" />;
  }

  if (queue.length === 0) {
    return (
      <Centered>
        <p className="text-base font-semibold text-ink">{t('empty')}</p>
        <p className="text-sm leading-relaxed text-muted">{t('emptyHint')}</p>
        <Link
          href="/vocabulaire"
          className="flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink"
        >
          {t('backToList')}
        </Link>
      </Centered>
    );
  }

  const entry = queue[position];

  if (!entry) {
    return (
      <Centered>
        <p className="text-2xl font-bold text-ink">{t('reviewDone')}</p>
        <p className="text-base text-muted">
          {t('reviewScore', { known: progress.known, total: queue.length })}
        </p>
        <Link
          href="/vocabulaire"
          className="flex min-h-12 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink"
        >
          {t('backToList')}
        </Link>
      </Centered>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="px-1 font-mono text-xs text-dim">
        {t('reviewPosition', { current: position + 1, total: queue.length })}
      </p>

      <div className="mt-3 flex flex-1 flex-col justify-center">
        <article className="rounded-2xl border border-line bg-surface px-5 py-6">
          <p className="text-center text-3xl font-semibold leading-tight text-ink">{entry.term}</p>

          <p className="mt-5 text-center text-base leading-relaxed text-muted">
            <HighlightedText text={entry.cueText} query={entry.term} />
          </p>
          <p className="mt-2 text-center font-mono text-xs text-dim">
            {[entry.titleName, entry.episodeLabel, formatTimestamp(entry.startMs)]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {revealed ? (
            <div className="mt-6 border-t border-line pt-4">
              {entry.translation ? (
                <p className="text-lg font-semibold leading-snug text-accent">
                  {entry.translation}
                </p>
              ) : (
                <p className="text-sm text-dim">{t('noTranslation')}</p>
              )}
              {entry.explanation ? (
                <p className="mt-2 text-sm leading-relaxed text-ink">{entry.explanation}</p>
              ) : null}
              {entry.reviews > 0 ? (
                <p className="mt-3 text-xs text-dim">
                  {t('reviewHistory', { reviews: entry.reviews, failures: entry.failures })}
                </p>
              ) : null}
            </div>
          ) : null}
        </article>
      </div>

      <div className="pb-safe mt-4 flex items-stretch gap-3">
        {revealed ? (
          <>
            <button
              type="button"
              onClick={() => answer(entry, false)}
              className="min-h-14 flex-1 rounded-2xl border border-danger/40 bg-danger/10 text-base font-semibold text-danger"
            >
              {t('notKnown')}
            </button>
            <button
              type="button"
              onClick={() => answer(entry, true)}
              className="min-h-14 flex-1 rounded-2xl bg-accent text-base font-semibold text-accent-ink"
            >
              {t('known')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="min-h-14 flex-1 rounded-2xl border border-line bg-surface text-base font-semibold text-ink"
          >
            {t('reveal')}
          </button>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      {children}
    </div>
  );
}
