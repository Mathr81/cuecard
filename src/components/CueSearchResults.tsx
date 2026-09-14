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
      <div className="flex flex-col gap-3 px-6 py-14 text-center">
        <p className="text-lg font-semibold tracking-tight text-ink">{t('noResults')}</p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">{t('noResultsHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <p className="px-4 py-3 text-[0.8125rem] text-dim">
        {t('resultsCount', { count: results.length })}
      </p>
      <ul className="divide-y divide-line">
        {results.map((result) => (
          <li key={result.cue.index}>
            <button
              type="button"
              onClick={() => onSelect(result.cue.index)}
              className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors active:bg-surface"
            >
              <span className="mt-1 min-w-16 shrink-0 font-mono text-xs tabular-nums text-dim">
                {formatTimestamp(result.cue.startMs)}
              </span>
              <span className="flex-1 text-base leading-relaxed text-ink">
                <HighlightedText text={result.cue.text.replace(/\n/g, ' ')} query={query} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
