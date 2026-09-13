'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AudioButton } from '@/components/AudioButton';
import { DictionaryLookupError, lookupWord } from '@/lib/dictionary/client';
import type {
  DictionaryEntry,
  DictionaryErrorCode,
  DictionaryMeaning,
} from '@/lib/dictionary/types';

/** Natures grammaticales traduites ; toute autre valeur est affichée telle quelle. */
const KNOWN_PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'exclamation',
  'determiner',
  'article',
  'numeral',
  'particle',
  'abbreviation',
  'phrase',
  'prefix',
  'suffix',
] as const;

const VISIBLE_DEFINITIONS = 3;

type State =
  | { status: 'loading' }
  | { status: 'ready'; entry: DictionaryEntry }
  | { status: 'error'; code: DictionaryErrorCode };

/** Le parent remonte ce bloc via `key={term}` : l'état de départ est donc
 *  toujours « chargement », sans avoir à le remettre depuis un effet. */
export function DictionaryBlock({ term, isExpression }: { term: string; isExpression: boolean }) {
  const t = useTranslations('definition');
  const tErrors = useTranslations('errors');
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isExpression) return;

    const controller = new AbortController();

    lookupWord(term, controller.signal)
      .then((entry) => setState({ status: 'ready', entry }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          code: cause instanceof DictionaryLookupError ? cause.code : 'network',
        });
      });

    return () => controller.abort();
  }, [term, isExpression, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  if (isExpression) {
    // Le dictionnaire monolingue n'indexe que des mots : le dire franchement
    // vaut mieux qu'une erreur 404 déguisée.
    return (
      <Block title={t('dictionary')}>
        <p className="text-sm leading-relaxed text-muted">{t('expressionNoEntry')}</p>
        <p className="mt-2 text-sm leading-relaxed text-dim">{t('expressionHint')}</p>
      </Block>
    );
  }

  if (state.status === 'loading') {
    return (
      <Block title={t('dictionary')}>
        <div className="flex flex-col gap-2" aria-live="polite" aria-busy="true">
          <span className="sr-only">{t('dictionaryLoading')}</span>
          <div className="h-4 w-24 animate-pulse rounded bg-surface-high" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-high" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-surface-high" />
        </div>
      </Block>
    );
  }

  if (state.status === 'error') {
    const isMissing = state.code === 'not_found';
    return (
      <Block title={t('dictionary')}>
        <p className="text-sm leading-relaxed text-muted">
          {isMissing
            ? tErrors('dictionaryNotFound', { word: term })
            : tErrors(state.code === 'network' ? 'dictionaryNetwork' : 'dictionaryUpstream')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-dim">
          {isMissing ? tErrors('dictionaryNotFoundHint') : tErrors('dictionaryRetryHint')}
        </p>
        {!isMissing ? (
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

  const { entry } = state;
  const matchedOtherForm = entry.word.toLowerCase() !== term.toLowerCase();

  return (
    <Block title={t('dictionary')}>
      <div className="flex flex-wrap items-center gap-3">
        {entry.phonetic ? (
          <span className="font-mono text-base text-accent">{entry.phonetic}</span>
        ) : null}
        {entry.audio ? (
          <AudioButton key={entry.audio.url} url={entry.audio.url} accent={entry.audio.accent} />
        ) : null}
      </div>

      {matchedOtherForm ? (
        <p className="mt-2 text-xs text-dim">{t('matchedForm', { word: entry.word })}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-5">
        {entry.meanings.map((meaning) => (
          <MeaningSection key={meaning.partOfSpeech} meaning={meaning} />
        ))}
      </div>
    </Block>
  );
}

function MeaningSection({ meaning }: { meaning: DictionaryMeaning }) {
  const t = useTranslations('definition');
  const [expanded, setExpanded] = useState(false);

  const label = (KNOWN_PARTS_OF_SPEECH as readonly string[]).includes(meaning.partOfSpeech)
    ? t(`partOfSpeech.${meaning.partOfSpeech}`)
    : meaning.partOfSpeech;

  const hidden = meaning.definitions.length - VISIBLE_DEFINITIONS;
  const shown = expanded ? meaning.definitions : meaning.definitions.slice(0, VISIBLE_DEFINITIONS);

  return (
    <section>
      <h4 className="mb-2 inline-flex rounded-full bg-surface-high px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
        {label}
      </h4>

      <ol className="flex list-none flex-col gap-3">
        {shown.map((definition, index) => (
          <li key={definition.text} className="flex gap-2.5">
            <span className="mt-0.5 font-mono text-xs text-dim">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.95rem] leading-relaxed text-ink">{definition.text}</p>
              {definition.example ? (
                <p className="mt-1 border-l-2 border-line pl-2.5 text-sm italic leading-relaxed text-muted">
                  {definition.example}
                </p>
              ) : null}
              {definition.synonyms.length > 0 ? (
                <p className="mt-1.5 text-xs text-dim">
                  {t('synonyms')} : {definition.synonyms.join(', ')}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 min-h-11 text-sm font-medium text-accent"
        >
          {expanded ? t('showLess') : t('showMore', { count: hidden })}
        </button>
      ) : null}
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-dim">{title}</h3>
      {children}
    </section>
  );
}
