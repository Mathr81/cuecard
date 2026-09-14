'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiGet, apiSend } from '@/lib/api/client';
import type { ContextualSense } from '@/lib/sense/schema';
import type { VocabularyEntry } from '@/lib/vocabulary/types';

export interface SaveTarget {
  term: string;
  cueText: string;
  titleKey: string;
  titleName: string;
  episodeLabel: string | null;
  startMs: number;
}

function payload(target: SaveTarget, sense: ContextualSense | null) {
  return {
    ...target,
    translation: sense?.traduction_contextuelle ?? null,
    explanation: sense?.explication ?? null,
    register: sense?.registre ?? null,
    kind: sense?.type ?? null,
  };
}

/** `undefined` : on ne sait pas encore. `null` : pas dans le carnet. */
type Known = VocabularyEntry | null | undefined;

export function SaveToNotebook({
  target,
  sense,
}: {
  target: SaveTarget;
  sense: ContextualSense | null;
}) {
  const t = useTranslations('vocabulary');
  const [entry, setEntry] = useState<Known>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      term: target.term,
      titleKey: target.titleKey,
      startMs: String(target.startMs),
    });

    apiGet<{ entry: VocabularyEntry | null }>(`/api/vocabulary/lookup?${query}`, controller.signal)
      .then((data) => setEntry(data.entry))
      .catch(() => {
        if (!controller.signal.aborted) setEntry(null);
      });

    return () => controller.abort();
  }, [target]);

  useEffect(() => {
    // J'ai sauvegardé avant que l'explication n'arrive : on complète l'entrée
    // au lieu de la laisser vide, sans rien demander de plus.
    if (!sense || !entry || entry.translation) return;

    const controller = new AbortController();
    apiSend<{ entry: VocabularyEntry }>(
      '/api/vocabulary',
      'POST',
      payload(target, sense),
      controller.signal
    )
      .then((data) => setEntry(data.entry))
      .catch(() => undefined);

    return () => controller.abort();
  }, [sense, entry, target]);

  async function save() {
    setBusy(true);
    try {
      const data = await apiSend<{ entry: VocabularyEntry }>(
        '/api/vocabulary',
        'POST',
        payload(target, sense)
      );
      setEntry(data.entry);
    } catch {
      setEntry(null);
    } finally {
      setBusy(false);
    }
  }

  async function forget(id: number) {
    setBusy(true);
    setEntry(null);
    await apiSend(`/api/vocabulary?id=${id}`, 'DELETE').catch(() => undefined);
    setBusy(false);
  }

  if (entry === undefined) {
    return <div className="mt-1 h-11 animate-pulse rounded-xl bg-surface-high" />;
  }

  if (entry === null) {
    return (
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface-high text-sm font-semibold text-ink disabled:opacity-50"
      >
        <span aria-hidden>☆</span>
        {t('save')}
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-stretch gap-2">
      <span className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/15 text-sm font-semibold text-accent">
        <span aria-hidden>★</span>
        {t('saved')}
      </span>
      <button
        type="button"
        onClick={() => void forget(entry.id)}
        disabled={busy}
        aria-label={t('remove')}
        className="min-h-11 w-12 shrink-0 rounded-xl border border-line bg-surface-high text-lg text-muted disabled:opacity-50"
      >
        ×
      </button>
    </div>
  );
}
