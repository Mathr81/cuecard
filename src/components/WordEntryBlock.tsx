'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, apiGet, type ApiErrorCode } from '@/lib/api/client';
import type { TokenUsage } from '@/lib/openrouter/types';
import type { WordEntry } from '@/lib/sense/entry';

interface Response {
  entry: WordEntry;
  usage: TokenUsage;
  model: string;
  cached: boolean;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; entry: WordEntry }
  | { status: 'error'; code: ApiErrorCode };

/** Trois sens tiennent dans l'écran d'un téléphone ; le reste se déplie. */
const VISIBLE_SENSES = 3;

/**
 * L'entrée bilingue du mot : ce qu'il veut dire en général, pas dans cette
 * réplique-là. C'est celle qu'on révise — la traduction contextuelle, au-dessus,
 * ne vaut que pour la scène en cours.
 */
export function WordEntryBlock({ term }: { term: string }) {
  const t = useTranslations('entry');
  const tErrors = useTranslations('errors');
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiGet<Response>(`/api/entry/${encodeURIComponent(term)}`, controller.signal)
      .then((data) => setState({ status: 'ready', entry: data.entry }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', code: cause instanceof ApiError ? cause.code : 'upstream' });
      });

    return () => controller.abort();
  }, [term, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  if (state.status === 'loading') {
    return (
      <Block title={t('title')}>
        <div className="flex flex-col gap-2" aria-live="polite" aria-busy="true">
          <span className="sr-only">{t('loading')}</span>
          <div className="h-6 w-3/5 animate-pulse rounded bg-surface-high" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-high" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-surface-high" />
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

  return (
    <Block title={t('title')}>
      <SenseList senses={state.entry.traductions} />

      {state.entry.expressions.length > 0 ? (
        <section className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-dim">
            {t('expressions')}
          </h4>
          <ul className="mt-2 flex flex-col gap-2">
            {state.entry.expressions.map((expression) => (
              <li key={expression.en} className="border-l-2 border-line pl-2.5">
                <p className="text-sm font-medium leading-relaxed text-ink">{expression.en}</p>
                <p className="text-sm leading-relaxed text-muted">{expression.fr}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {state.entry.piege ? (
        <div className="mt-4 rounded-xl border border-line bg-surface-high px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-dim">{t('trap')}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{state.entry.piege}</p>
        </div>
      ) : null}
    </Block>
  );
}

function SenseList({ senses }: { senses: WordEntry['traductions'] }) {
  const t = useTranslations('entry');
  const [expanded, setExpanded] = useState(false);

  const hidden = senses.length - VISIBLE_SENSES;
  const shown = expanded ? senses : senses.slice(0, VISIBLE_SENSES);

  return (
    <>
      <ol className="flex list-none flex-col gap-4">
        {shown.map((sense, index) => (
          <SenseRow
            key={`${sense.nature}-${sense.equivalents[0]}`}
            sense={sense}
            rank={index + 1}
          />
        ))}
      </ol>

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 min-h-11 w-full rounded-xl border border-line bg-surface-high px-4 text-sm font-semibold text-ink"
        >
          {expanded ? t('showLess') : t('showMore', { count: hidden })}
        </button>
      ) : null}
    </>
  );
}

function SenseRow({ sense, rank }: { sense: WordEntry['traductions'][number]; rank: number }) {
  const tParts = useTranslations('definition');
  const tRegister = useTranslations('sense');

  return (
    <li className="flex gap-2.5">
      <span className="mt-1 font-mono text-xs text-dim">{rank}</span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-snug text-accent">
          {sense.equivalents.join(', ')}
        </p>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge>{tParts(`partOfSpeech.${partKey(sense.nature)}`)}</Badge>
          {/* Le registre neutre n'apprend rien : ne l'afficher que s'il marque. */}
          {sense.registre !== 'neutre' ? (
            <Badge>{tRegister(`register.${sense.registre}`)}</Badge>
          ) : null}
        </div>

        {sense.precision ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{sense.precision}</p>
        ) : null}

        {sense.exemple ? (
          <div className="mt-2 border-l-2 border-line pl-2.5">
            <p className="text-sm leading-relaxed text-ink">{sense.exemple.en}</p>
            <p className="text-sm leading-relaxed text-muted">{sense.exemple.fr}</p>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** Les clés de traduction n'ont ni espace ni accent, les valeurs du contrat si. */
function partKey(nature: string): string {
  return nature === 'phrasal verb' ? 'phrasalVerb' : nature;
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
