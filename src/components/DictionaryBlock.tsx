'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AudioButton } from '@/components/AudioButton';
import { MoreButton, PanelSection, RetryButton, Skeleton } from '@/components/panel';
import { DictionaryLookupError, lookupWord } from '@/lib/dictionary/client';
import type {
  DictionaryEntry,
  DictionaryErrorCode,
  DictionaryMeaning,
  DictionarySource,
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
  'contraction',
  'name',
  'proverb',
  'symbol',
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
  }, [term, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  if (state.status === 'loading') {
    return (
      <PanelSection label={t('dictionary')}>
        <Skeleton label={t('dictionaryLoading')} widths={['w-24', 'w-full', 'w-4/5']} />
      </PanelSection>
    );
  }

  if (state.status === 'error') {
    const isMissing = state.code === 'not_found';
    const missingMessage = isExpression
      ? t('expressionNoEntry')
      : tErrors('dictionaryNotFound', { word: term });
    const missingHint = isExpression ? t('expressionHint') : tErrors('dictionaryNotFoundHint');

    return (
      <PanelSection label={t('dictionary')}>
        <p className="text-sm leading-relaxed text-muted">
          {isMissing
            ? missingMessage
            : tErrors(state.code === 'network' ? 'dictionaryNetwork' : 'dictionaryUpstream')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-dim">
          {isMissing ? missingHint : tErrors('dictionaryRetryHint')}
        </p>
        {!isMissing ? <RetryButton label={tErrors('retry')} onClick={retry} /> : null}
      </PanelSection>
    );
  }

  const { entry } = state;
  const matchedOtherForm = entry.word.toLowerCase() !== term.toLowerCase();

  return (
    <PanelSection label={t('dictionary')}>
      {entry.phonetic || entry.audio ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {entry.phonetic ? (
            <span className="font-mono text-base text-muted">{entry.phonetic}</span>
          ) : null}
          {entry.audio ? (
            <AudioButton key={entry.audio.url} url={entry.audio.url} accent={entry.audio.accent} />
          ) : null}
        </div>
      ) : null}

      {matchedOtherForm ? (
        <p className="mb-3 text-[0.8125rem] text-dim">{t('matchedForm', { word: entry.word })}</p>
      ) : null}

      <div className="flex flex-col gap-6">
        {entry.meanings.map((meaning) => (
          <MeaningSection key={meaning.partOfSpeech} meaning={meaning} />
        ))}
      </div>

      <SourceNote source={entry.source} />
    </PanelSection>
  );
}

/** Dire d'où vient la définition : les sources ne se valent pas, et celles
 *  tirées de Wiktionary sont sous licence CC BY-SA, qui demande d'être citée. */
function SourceNote({ source }: { source: DictionarySource }) {
  const t = useTranslations('definition');
  const name = t(`sources.${source.id}`);
  const label = source.license ? `${name} · ${source.license}` : name;

  return (
    <p className="mt-6 border-t border-line pt-3 text-xs leading-relaxed text-dim">
      {t('sourceLabel')}{' '}
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          {label}
        </a>
      ) : (
        label
      )}
    </p>
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
      {/* La nature grammaticale est une étiquette de rangement, pas un titre :
          elle se lit comme le reste et ne porte pas de fond. */}
      <h4 className="mb-2.5 text-[0.8125rem] text-dim">{label}</h4>

      <ol className="flex list-none flex-col gap-3.5">
        {shown.map((definition, index) => (
          <li key={definition.text} className="flex gap-3">
            <span className="mt-1 font-mono text-xs tabular-nums text-dim">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] leading-relaxed text-ink">{definition.text}</p>
              {definition.example ? (
                <p className="mt-1.5 border-l border-line pl-3 text-sm leading-relaxed text-muted">
                  {definition.example}
                </p>
              ) : null}
              {definition.synonyms.length > 0 ? (
                <p className="mt-1.5 text-[0.8125rem] text-dim">
                  {t('synonyms')} : {definition.synonyms.join(', ')}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {hidden > 0 ? (
        <MoreButton
          label={expanded ? t('showLess') : t('showMore', { count: hidden })}
          onClick={() => setExpanded((value) => !value)}
        />
      ) : null}
    </section>
  );
}
