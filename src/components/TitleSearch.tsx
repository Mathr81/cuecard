'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ExternalError } from '@/components/ExternalError';
import { TitlePoster } from '@/components/TitlePoster';
import { ApiError, apiGet, type ApiErrorCode } from '@/lib/api/client';
import type { TmdbSearchResult } from '@/lib/titles/types';

/** Assez court pour ne pas se sentir, assez long pour ne pas appeler TMDB à
 *  chaque lettre. */
const DEBOUNCE_MS = 300;

/** L'état porte la requête à laquelle il répond : sans ça, les résultats de la
 *  frappe précédente s'affichent une fraction de seconde sous la nouvelle. */
type State =
  | { query: string; status: 'loading' }
  | { query: string; status: 'ready'; results: TmdbSearchResult[] }
  | { query: string; status: 'error'; code: ApiErrorCode };

export function TitleSearch() {
  const t = useTranslations('titles');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State | null>(null);
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const searchable = trimmed.length >= 2;
  // Un état qui ne répond pas à la requête en cours n'a rien à montrer.
  const current = state?.query === trimmed ? state : null;

  useEffect(() => {
    if (!searchable) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState({ query: trimmed, status: 'loading' });
      apiGet<{ results: TmdbSearchResult[] }>(
        `/api/tmdb/search?q=${encodeURIComponent(trimmed)}&lang=${locale}`,
        controller.signal
      )
        .then((data) => setState({ query: trimmed, status: 'ready', results: data.results }))
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setState({
            query: trimmed,
            status: 'error',
            code: cause instanceof ApiError ? cause.code : 'upstream',
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, searchable, locale, attempt]);

  return (
    <section className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="search"
        value={query}
        autoFocus
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchLabel')}
        enterKeyHint="search"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="h-14 w-full rounded-xl bg-surface px-4 text-base text-ink placeholder:text-dim"
      />

      {searchable && (current === null || current.status === 'loading') ? (
        <p className="text-sm text-dim" aria-live="polite">
          {t('searching')}
        </p>
      ) : null}

      {current?.status === 'error' ? (
        <ExternalError
          code={current.code}
          service="TMDB"
          onRetry={() => {
            setState(null);
            setAttempt((value) => value + 1);
          }}
        />
      ) : null}

      {current?.status === 'ready' && current.results.length === 0 ? (
        <div>
          <p className="text-sm text-muted">{t('noResults')}</p>
          <p className="mt-1 text-sm text-dim">{t('noResultsHint')}</p>
        </div>
      ) : null}

      {current?.status === 'ready' && current.results.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {current.results.map((result) => (
            <li key={`${result.mediaType}-${result.tmdbId}`}>
              <Link
                href={`/title/${result.mediaType}/${result.tmdbId}`}
                className="press flex min-h-20 items-center gap-3 rounded-xl bg-surface p-2 pr-4 active:bg-surface-high"
              >
                <TitlePoster path={result.posterPath} alt={result.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-ink">
                    {result.name}
                  </span>
                  <span className="mt-1 block text-sm text-dim">
                    {[result.year, t(`mediaType.${result.mediaType}`)].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
