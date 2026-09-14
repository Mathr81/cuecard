'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, apiSend, type ApiErrorCode } from '@/lib/api/client';
import type { TokenUsage } from '@/lib/openrouter/types';
import type { ContextualSense } from '@/lib/sense/schema';
import { useTokenStore } from '@/store/tokens';

export interface SenseContext {
  lines: string[];
  targetIndex: number;
  title: string;
  year: number | null;
  genres: string[];
}

interface Response {
  sense: ContextualSense;
  usage: TokenUsage;
  model: string;
  cached: boolean;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; sense: ContextualSense; cached: boolean }
  | { status: 'error'; code: ApiErrorCode };

/**
 * La vraie valeur ajoutée : le sens ICI, pas l'entrée de dictionnaire. Le bloc
 * est indépendant des autres — le LLM est le plus lent des trois et ne doit
 * jamais retarder l'affichage du dictionnaire.
 */
export function ContextualSenseBlock({ term, context }: { term: string; context: SenseContext }) {
  const t = useTranslations('sense');
  const tErrors = useTranslations('errors');
  const record = useTokenStore((state) => state.record);

  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiSend<Response>('/api/sense', 'POST', { term, ...context }, controller.signal)
      .then((data) => {
        record(data.usage, data.cached);
        setState({ status: 'ready', sense: data.sense, cached: data.cached });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', code: cause instanceof ApiError ? cause.code : 'upstream' });
      });

    return () => controller.abort();
  }, [term, context, record, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  if (state.status === 'loading') {
    return (
      <Block title={t('title')}>
        <div className="flex flex-col gap-2" aria-live="polite" aria-busy="true">
          <span className="sr-only">{t('loading')}</span>
          <div className="h-6 w-2/3 animate-pulse rounded bg-surface-high" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-high" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-surface-high" />
        </div>
      </Block>
    );
  }

  if (state.status === 'error') {
    return (
      <Block title={t('title')}>
        <p className="text-sm leading-relaxed text-muted">
          {tErrors(`external.${state.code}`, { service: 'OpenRouter' })}
        </p>
        {state.code !== 'missing_key' ? (
          <button
            type="button"
            onClick={retry}
            className="mt-3 min-h-11 rounded-xl border border-line bg-surface-high px-4 text-sm font-semibold text-ink"
          >
            {tErrors('retry')}
          </button>
        ) : null}
      </Block>
    );
  }

  const { sense } = state;

  return (
    <Block title={t('title')}>
      <p className="text-lg font-semibold leading-snug text-accent">
        {sense.traduction_contextuelle}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge>{t(`register.${sense.registre}`)}</Badge>
        <Badge>{t(`kind.${badgeKey(sense.type)}`)}</Badge>
      </div>

      <p className="mt-3 text-[0.95rem] leading-relaxed text-ink">{sense.explication}</p>

      {sense.note_culturelle ? (
        <div className="mt-3 rounded-xl border border-line bg-surface-high px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-dim">
            {t('culturalNote')}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{sense.note_culturelle}</p>
        </div>
      ) : null}

      {sense.exemples.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {sense.exemples.map((example) => (
            <li key={example.en} className="border-l-2 border-line pl-2.5">
              <p className="text-sm leading-relaxed text-ink">{example.en}</p>
              <p className="text-sm leading-relaxed text-muted">{example.fr}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Block>
  );
}

/** Les valeurs du contrat portent des accents et des espaces ; les clés de
 *  traduction, non. */
const BADGE_KEYS: Record<string, string> = {
  littéral: 'literal',
  idiome: 'idiom',
  'phrasal verb': 'phrasalVerb',
  'référence culturelle': 'culturalReference',
  'jeu de mots': 'wordplay',
};

function badgeKey(type: string): string {
  return BADGE_KEYS[type] ?? 'literal';
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-surface-high px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-dim">{title}</h3>
      {children}
    </section>
  );
}
