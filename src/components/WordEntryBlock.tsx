'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Callout,
  Example,
  Meta,
  MoreButton,
  PanelSection,
  RetryButton,
  Skeleton,
} from '@/components/panel';
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
 * réplique-là. C'est celle qu'on révise. La traduction contextuelle, au-dessus,
 * ne vaut que pour la scène en cours : elle garde l'ambre, celle-ci reste en
 * blanc, et la hiérarchie du panneau se lit sans avoir à lire.
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
      <PanelSection label={t('title')}>
        <Skeleton label={t('loading')} widths={['w-3/5', 'w-full', 'w-2/3']} />
      </PanelSection>
    );
  }

  if (state.status === 'error') {
    return (
      <PanelSection label={t('title')}>
        <p className="text-sm leading-relaxed text-muted">
          {tErrors(`external.${state.code}`, { service: 'OpenRouter' })}
        </p>
        {state.code !== 'missing_key' ? (
          <RetryButton label={tErrors('retry')} onClick={retry} />
        ) : null}
      </PanelSection>
    );
  }

  return (
    <PanelSection label={t('title')}>
      <SenseList senses={state.entry.traductions} />

      {state.entry.expressions.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-[0.8125rem] text-dim">{t('expressions')}</h4>
          <ul className="mt-3 flex flex-col gap-3">
            {state.entry.expressions.map((expression) => (
              <li key={expression.en}>
                <Example en={expression.en} fr={expression.fr} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.entry.piege ? <Callout label={t('trap')}>{state.entry.piege}</Callout> : null}
    </PanelSection>
  );
}

function SenseList({ senses }: { senses: WordEntry['traductions'] }) {
  const t = useTranslations('entry');
  const [expanded, setExpanded] = useState(false);

  const hidden = senses.length - VISIBLE_SENSES;
  const shown = expanded ? senses : senses.slice(0, VISIBLE_SENSES);

  return (
    <>
      <ol className="flex list-none flex-col gap-5">
        {shown.map((sense, index) => (
          <SenseRow
            key={`${sense.nature}-${sense.equivalents[0]}`}
            sense={sense}
            rank={index + 1}
          />
        ))}
      </ol>

      {hidden > 0 ? (
        <MoreButton
          label={expanded ? t('showLess') : t('showMore', { count: hidden })}
          onClick={() => setExpanded((value) => !value)}
        />
      ) : null}
    </>
  );
}

function SenseRow({ sense, rank }: { sense: WordEntry['traductions'][number]; rank: number }) {
  const tParts = useTranslations('definition');
  const tRegister = useTranslations('sense');

  return (
    <li className="flex gap-3">
      <span className="mt-1 font-mono text-xs tabular-nums text-dim">{rank}</span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-snug text-ink">
          {sense.equivalents.join(', ')}
        </p>

        <Meta
          parts={[
            tParts(`partOfSpeech.${partKey(sense.nature)}`),
            // Le registre neutre n'apprend rien : ne l'afficher que s'il marque.
            sense.registre === 'neutre' ? null : tRegister(`register.${sense.registre}`),
          ]}
        />

        {/* Ce qui distingue ce sens du précédent : une phrase, sur sa ligne,
            pas un troisième fragment collé à la nature grammaticale. */}
        {sense.precision ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{sense.precision}</p>
        ) : null}

        {sense.exemple ? (
          <div className="mt-3">
            <Example en={sense.exemple.en} fr={sense.exemple.fr} />
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
