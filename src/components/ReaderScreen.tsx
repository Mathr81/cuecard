'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CuePlayer } from '@/components/CuePlayer';
import { CueSearchResults } from '@/components/CueSearchResults';
import type { CueSelection } from '@/components/CueText';
import { DefinitionPanel, type Lookup } from '@/components/DefinitionPanel';
import {
  ArrowLeft,
  CaretLeft,
  CaretRight,
  ICON,
  ICON_LARGE,
  X,
  iconProps,
} from '@/components/icons';
import { sceneAround } from '@/lib/sense/context';
import { episodeLabel } from '@/lib/titles/key';
import { TimeSheet, type TimeSheetMode } from '@/components/TimeSheet';
import { useOffset } from '@/hooks/useOffset';
import { computeOffset, findCueAtTime, toCueTime } from '@/lib/subtitles/offset';
import { formatOffset } from '@/lib/time';
import { CueSearchIndex } from '@/lib/subtitles/search';
import { useSubtitleStore } from '@/store/subtitles';

export function ReaderScreen() {
  const t = useTranslations('reader');
  const tErrors = useTranslations('errors');
  const tCommon = useTranslations('common');
  const tTiming = useTranslations('timing');

  const doc = useSubtitleStore((state) => state.document);
  const hydrated = useSubtitleStore((state) => state.hydrated);
  const currentIndex = useSubtitleStore((state) => state.currentIndex);
  const goTo = useSubtitleStore((state) => state.goTo);
  const step = useSubtitleStore((state) => state.step);

  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<
    (Lookup & { selection: CueSelection; cueIndex: number }) | null
  >(null);
  const [timeSheet, setTimeSheet] = useState<TimeSheetMode | null>(null);
  const {
    offsetMs,
    saveFailed: offsetSaveFailed,
    save: saveOffset,
    reset: resetOffset,
  } = useOffset(doc?.titleKey ?? null, doc?.fileId ?? null);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedFor = useRef<string | null>(null);

  // Changer de réplique referme la feuille : une définition n'a de sens que
  // pour la réplique dont elle vient.
  const activeLookup = lookup?.cueIndex === currentIndex ? lookup : null;

  const searchIndex = useMemo(() => (doc ? new CueSearchIndex(doc.cues) : null), [doc]);
  const results = useMemo(
    () => (searchIndex ? searchIndex.search(deferredQuery) : []),
    [searchIndex, deferredQuery]
  );

  // À l'ouverture d'un titre, la première chose que je veux c'est chercher une
  // réplique : le champ prend le focus tout seul, une seule fois par fichier.
  useEffect(() => {
    if (!doc || focusedFor.current === doc.id) return;
    focusedFor.current = doc.id;
    inputRef.current?.focus();
  }, [doc]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (event.key === 'Escape' && typing) {
        inputRef.current?.blur();
        return;
      }
      if (typing) return;
      if (event.key === '/') {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step]);

  if (!hydrated) {
    return <CenteredMessage>{tCommon('loading')}</CenteredMessage>;
  }

  if (!doc) {
    return (
      <CenteredMessage action={{ href: '/', label: tErrors('noDocumentAction') }}>
        {tErrors('noDocument')}
      </CenteredMessage>
    );
  }

  if (doc.cues.length === 0) {
    return (
      <CenteredMessage action={{ href: '/', label: tErrors('noDocumentAction') }}>
        {t('empty')}
      </CenteredMessage>
    );
  }

  const searching = query.trim().length > 0;

  function selectCue(index: number) {
    goTo(index);
    setQuery('');
    inputRef.current?.blur();
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col overflow-hidden">
      {/* L'en-tête ne porte qu'un seul objet, le champ de recherche. Le reste
          est du texte posé : dans le noir, chaque cadre en plus est du bruit
          qui dispute la place à la réplique. */}
      <header className="pt-safe shrink-0 border-b border-line px-3 pb-3">
        <div className="flex items-center gap-1 py-1">
          <Link
            href="/"
            aria-label={tCommon('back')}
            className="press -ml-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted"
          >
            <ArrowLeft size={ICON} {...iconProps} />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-sm text-muted">{doc.name}</h1>
          <span className="shrink-0 pl-2 font-mono text-xs tabular-nums text-dim">
            {t('position', { current: currentIndex + 1, total: doc.cues.length })}
          </span>
        </div>

        <div className="relative mt-1">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchLabel')}
            enterKeyHint="search"
            inputMode="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-14 w-full rounded-xl bg-surface pl-4 pr-14 text-base text-ink placeholder:text-dim"
          />
          {searching ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label={t('clear')}
              className="press absolute right-1 top-1 flex size-12 items-center justify-center rounded-xl text-muted"
            >
              <X size={ICON} {...iconProps} />
            </button>
          ) : null}
        </div>

        {/* Mode B : la recherche par temps reste à un tap, sans encombrer le
            mode texte qui est celui que j'utilise dix fois sur dix. */}
        <div className="mt-1 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setTimeSheet('goto')}
            className="press -ml-1 min-h-11 whitespace-nowrap rounded-xl px-1 text-sm text-dim"
          >
            {tTiming('gotoButton')}
          </button>
          <button
            type="button"
            onClick={() => setTimeSheet('calibrate')}
            className="press min-h-11 whitespace-nowrap rounded-xl px-1 text-sm text-dim"
          >
            {tTiming('calibrateButton')}
          </button>

          {offsetMs !== 0 ? (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-accent/15 py-1 pl-3 pr-1 font-mono text-sm tabular-nums text-accent">
              {formatOffset(offsetMs)}
              <button
                type="button"
                onClick={resetOffset}
                aria-label={tTiming('resetOffset')}
                className="press flex size-9 items-center justify-center rounded-full"
              >
                <X size={14} {...iconProps} />
              </button>
            </span>
          ) : null}
        </div>

        {offsetSaveFailed ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            {tTiming('offsetNotSaved')}
          </p>
        ) : null}
      </header>

      {searching ? (
        <main className="flex-1 overflow-y-auto pb-safe">
          <CueSearchResults results={results} query={deferredQuery} onSelect={selectCue} />
        </main>
      ) : (
        <>
          <main className="flex flex-1 flex-col overflow-hidden">
            <CuePlayer
              cues={doc.cues}
              currentIndex={currentIndex}
              onSelect={goTo}
              onStep={step}
              selection={activeLookup?.selection ?? null}
              onLookup={(selection, term) =>
                setLookup({
                  selection,
                  term,
                  cueIndex: currentIndex,
                  context: doc.cues[currentIndex].text.replace(/\n/g, ' '),
                  // La scène est figée au moment du tap : l'objet reste stable
                  // et le bloc LLM ne se relance pas à chaque rendu.
                  scene: {
                    ...sceneAround(doc.cues, currentIndex),
                    title: doc.title?.name ?? doc.name,
                    year: doc.title?.year ?? null,
                    genres: doc.title?.genres ?? [],
                  },
                  target: {
                    term,
                    cueText: doc.cues[currentIndex].text.replace(/\n/g, ' '),
                    titleKey: doc.titleKey,
                    titleName: doc.title?.name ?? doc.name,
                    episodeLabel: doc.title ? episodeLabel(doc.title) || null : null,
                    startMs: doc.cues[currentIndex].startMs,
                  },
                })
              }
            />
          </main>
          <nav className="pb-safe shrink-0 px-3 pt-2">
            <div className="flex items-stretch gap-2">
              <StepButton
                label={t('previous')}
                onClick={() => step(-1)}
                disabled={currentIndex === 0}
              >
                <CaretLeft size={ICON_LARGE} {...iconProps} />
              </StepButton>
              <StepButton
                label={t('next')}
                onClick={() => step(1)}
                disabled={currentIndex === doc.cues.length - 1}
              >
                <CaretRight size={ICON_LARGE} {...iconProps} />
              </StepButton>
            </div>
          </nav>
        </>
      )}

      <TimeSheet
        mode={timeSheet}
        currentCueStartMs={doc.cues[currentIndex].startMs}
        onClose={() => setTimeSheet(null)}
        onSubmit={(mode, playerMs) => {
          if (mode === 'calibrate') {
            saveOffset(computeOffset(playerMs, doc.cues[currentIndex].startMs));
          } else {
            goTo(findCueAtTime(doc.cues, toCueTime(playerMs, offsetMs)));
          }
          setTimeSheet(null);
        }}
      />

      <DefinitionPanel lookup={activeLookup} onClose={() => setLookup(null)} />
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="press flex h-16 flex-1 items-center justify-center rounded-xl bg-surface text-muted active:bg-surface-high disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function CenteredMessage({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="text-base leading-relaxed text-muted">{children}</p>
      {action ? (
        <Link
          href={action.href}
          className="press flex min-h-14 items-center rounded-xl bg-accent px-6 text-base font-semibold text-accent-ink"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
