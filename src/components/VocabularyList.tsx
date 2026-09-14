'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { HighlightedText } from '@/components/HighlightedText';
import { ICON, X, iconProps } from '@/components/icons';
import { apiGet, apiSend } from '@/lib/api/client';
import { formatTimestamp } from '@/lib/time';
import type { VocabularyEntry } from '@/lib/vocabulary/types';

export function VocabularyList() {
  const t = useTranslations('vocabulary');
  const [entries, setEntries] = useState<VocabularyEntry[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [query, setQuery] = useState('');
  const [titleKey, setTitleKey] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const controller = new AbortController();
    apiGet<{ entries: VocabularyEntry[] }>('/api/vocabulary', controller.signal)
      .then((data) => setEntries(data.entries))
      .catch(() => {
        // Hors ligne, le carnet n'est pas vide : il est injoignable. Le dire.
        if (!controller.signal.aborted) setUnreachable(true);
      });
    return () => controller.abort();
  }, []);

  // Les titres viennent de la liste complète : les filtres ne doivent pas
  // disparaître au fur et à mesure qu'on filtre.
  const titles = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of entries ?? []) seen.set(entry.titleKey, entry.titleName);
    return [...seen.entries()];
  }, [entries]);

  const visible = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return (entries ?? []).filter((entry) => {
      if (titleKey && entry.titleKey !== titleKey) return false;
      if (needle.length === 0) return true;
      return [entry.term, entry.cueText, entry.translation ?? ''].some((field) =>
        field.toLowerCase().includes(needle)
      );
    });
  }, [entries, deferredQuery, titleKey]);

  const groups = useMemo(() => {
    const byTitle = new Map<string, VocabularyEntry[]>();
    for (const entry of visible) {
      const group = byTitle.get(entry.titleKey) ?? [];
      group.push(entry);
      byTitle.set(entry.titleKey, group);
    }
    return [...byTitle.values()];
  }, [visible]);

  async function forget(id: number) {
    setEntries((current) => current?.filter((entry) => entry.id !== id) ?? null);
    await apiSend(`/api/vocabulary?id=${id}`, 'DELETE').catch(() => undefined);
  }

  if (unreachable) {
    return (
      <div className="rounded-2xl bg-surface px-5 py-8 text-center">
        <p className="text-lg font-semibold tracking-tight text-ink">{t('unreachable')}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('unreachableHint')}</p>
      </div>
    );
  }

  if (entries === null) {
    return <div className="h-24 animate-pulse rounded-xl bg-surface" />;
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl bg-surface px-5 py-8 text-center">
        <p className="text-lg font-semibold tracking-tight text-ink">{t('empty')}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchLabel')}
        autoCapitalize="none"
        autoCorrect="off"
        className="h-12 w-full rounded-xl bg-surface px-4 text-base text-ink placeholder:text-dim"
      />

      {titles.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <FilterChip active={titleKey === null} onClick={() => setTitleKey(null)}>
            {t('allTitles')}
          </FilterChip>
          {titles.map(([key, name]) => (
            <FilterChip key={key} active={titleKey === key} onClick={() => setTitleKey(key)}>
              {name}
            </FilterChip>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] text-dim">{t('count', { count: visible.length })}</p>
        <Link
          href="/vocabulaire/revision"
          className="press flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink"
        >
          {t('startReview')}
        </Link>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted">{t('noMatch')}</p>
      ) : (
        groups.map((group) => (
          <section key={group[0].titleKey} className="flex flex-col gap-2">
            <h2 className="text-[0.8125rem] text-dim">{group[0].titleName}</h2>
            <ul className="flex flex-col gap-2">
              {group.map((entry) => (
                <li key={entry.id} className="flex items-center gap-1">
                  <article className="min-w-0 flex-1 rounded-xl bg-surface px-4 py-3.5">
                    <div className="flex items-baseline gap-2">
                      <h3 className="truncate text-base font-semibold text-ink">{entry.term}</h3>
                      <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-dim">
                        {[entry.episodeLabel, formatTimestamp(entry.startMs)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    {entry.translation ? (
                      <p className="mt-1 text-sm font-medium text-accent">{entry.translation}</p>
                    ) : null}
                    <p className="mt-1.5 text-sm leading-relaxed text-dim">
                      <HighlightedText text={entry.cueText} query={entry.term} />
                    </p>
                  </article>
                  <button
                    type="button"
                    onClick={() => void forget(entry.id)}
                    aria-label={t('remove')}
                    className="press flex size-11 shrink-0 items-center justify-center rounded-xl text-dim"
                  >
                    <X size={ICON} {...iconProps} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`press min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium ${
        active ? 'bg-accent/15 text-accent' : 'bg-surface text-muted'
      }`}
    >
      {children}
    </button>
  );
}
