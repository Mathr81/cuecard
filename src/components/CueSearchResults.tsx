'use client';

import { useTranslations } from 'next-intl';
import { HighlightedText } from '@/components/HighlightedText';
import { formatTimestamp } from '@/lib/time';
import type { SearchResult } from '@/lib/subtitles/search';

interface Props {
  results: SearchResult[];
  query: string;
  onSelect: (index: number) => void;
}

export function CueSearchResults({ results, query, onSelect }: Props) {
  const t = useTranslations('reader');

  if (results.length === 0) {
    return (
      <div className="flex flex-col gap-2 px-4 py-10 text-center">
        <p className="text-base font-semibold text-ink">{t('noResults')}</p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">{t('noResultsHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-dim">
        {t('resultsCount', { count: results.length })}
      </p>
      <ul>
        {results.map((result) => (
          <li key={result.cue.index}>
            <button
              type="button"
              onClick={() => onSelect(result.cue.index)}
              className="flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left active:bg-surface-high"
            >
              <span className="mt-0.5 min-w-16 shrink-0 font-mono text-xs text-accent">
                {formatTimestamp(result.cue.startMs)}
              </span>
              <span className="flex-1 text-base leading-snug text-ink">
                <HighlightedText text={result.cue.text.replace(/\n/g, ' ')} query={query} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
