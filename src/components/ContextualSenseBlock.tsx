'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Callout, Example, Meta, PanelSection, RetryButton, Skeleton } from '@/components/panel';
import { ApiError, apiSend, type ApiErrorCode } from '@/lib/api/client';
import type { TokenUsage } from '@/lib/openrouter/types';
import type { ContextualSense } from '@/lib/sense/schema';

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
 * La vraie valeur ajoutée : le sens ICI, pas l'entrée de dictionnaire. C'est
 * la réponse à la question qu'on vient de poser, donc elle arrive sans
 * étiquette, juste sous le mot, dans le seul ambre du panneau.
 *
 * Le bloc est indépendant des autres : le LLM est le plus lent des trois et ne
 * doit jamais retarder l'affichage du dictionnaire.
 */
export function ContextualSenseBlock({
  term,
  context,
  onSense,
}: {
  term: string;
  context: SenseContext;
  /** Remonte le sens obtenu : le carnet le sauvegarde avec le mot. */
  onSense?: (sense: ContextualSense) => void;
}) {
  const t = useTranslations('sense');
  const tErrors = useTranslations('errors');
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiSend<Response>('/api/sense', 'POST', { term, ...context }, controller.signal)
      .then((data) => {
        setState({ status: 'ready', sense: data.sense, cached: data.cached });
        onSense?.(data.sense);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', code: cause instanceof ApiError ? cause.code : 'upstream' });
      });

    return () => controller.abort();
  }, [term, context, onSense, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  if (state.status === 'loading') {
    return (
      <PanelSection ariaLabel={t('title')}>
        <Skeleton label={t('loading')} widths={['w-2/3', 'w-full', 'w-4/5']} />
      </PanelSection>
    );
  }

  if (state.status === 'error') {
    return (
      <PanelSection ariaLabel={t('title')}>
        <p className="text-sm leading-relaxed text-muted">
          {tErrors(`external.${state.code}`, { service: 'OpenRouter' })}
        </p>
        {state.code !== 'missing_key' ? (
          <RetryButton label={tErrors('retry')} onClick={retry} />
        ) : null}
      </PanelSection>
    );
  }

  const { sense } = state;

  return (
    <PanelSection ariaLabel={t('title')}>
      <p className="text-[1.375rem] font-semibold leading-snug tracking-tight text-accent">
        {sense.traduction_contextuelle}
      </p>

      <Meta parts={[t(`register.${sense.registre}`), t(`kind.${badgeKey(sense.type)}`)]} />

      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink">{sense.explication}</p>

      {sense.note_culturelle ? (
        <Callout label={t('culturalNote')}>{sense.note_culturelle}</Callout>
      ) : null}

      {sense.exemples.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {sense.exemples.map((example) => (
            <li key={example.en}>
              <Example en={example.en} fr={example.fr} />
            </li>
          ))}
        </ul>
      ) : null}
    </PanelSection>
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
