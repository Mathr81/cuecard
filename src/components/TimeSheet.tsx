'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/BottomSheet';
import { computeOffset, MAX_OFFSET_MS, UNUSUAL_OFFSET_MS } from '@/lib/subtitles/offset';
import { formatOffset, formatTimestamp, parseTimeInput } from '@/lib/time';

export type TimeSheetMode = 'goto' | 'calibrate';

interface Props {
  mode: TimeSheetMode | null;
  /** Début de la réplique courante, sur laquelle on cale le timing. */
  currentCueStartMs: number;
  onClose: () => void;
  onSubmit: (mode: TimeSheetMode, playerMs: number) => void;
}

/**
 * Le même champ sert à sauter à un moment et à caler le timing : dans les deux
 * cas je recopie l'heure affichée par mon lecteur, et je la tape vite et mal.
 */
export function TimeSheet({ mode, currentCueStartMs, onClose, onSubmit }: Props) {
  const t = useTranslations('timing');
  const [value, setValue] = useState('');

  const playerMs = parseTimeInput(value);
  const offsetMs = playerMs === null ? null : computeOffset(playerMs, currentCueStartMs);

  // Un décalage aberrant vient d'un temps mal tapé : le refuser ici évite de
  // l'afficher comme mémorisé alors que la base le rejetterait.
  const outOfRange =
    mode === 'calibrate' && offsetMs !== null && Math.abs(offsetMs) > MAX_OFFSET_MS;
  const unusual =
    mode === 'calibrate' &&
    offsetMs !== null &&
    !outOfRange &&
    Math.abs(offsetMs) > UNUSUAL_OFFSET_MS;
  const valid = playerMs !== null && !outOfRange;

  function submit() {
    if (!valid || mode === null) return;
    onSubmit(mode, playerMs);
    setValue('');
  }

  return (
    <BottomSheet
      open={mode !== null}
      title={mode === 'calibrate' ? t('calibrateTitle') : t('gotoTitle')}
      onClose={() => {
        setValue('');
        onClose();
      }}
    >
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {mode === 'calibrate'
          ? t('calibrateHelp', { time: formatTimestamp(currentCueStartMs) })
          : t('gotoHelp')}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="mt-4 flex flex-col gap-3"
      >
        <input
          type="text"
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          placeholder={t('placeholder')}
          aria-label={t('inputLabel')}
          enterKeyHint="go"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-14 w-full rounded-xl bg-surface-high px-4 text-lg text-ink placeholder:text-dim"
        />

        {/* Montrer ce qui a été compris évite de retaper trois fois dans le noir. */}
        <p className="min-h-5 text-sm leading-relaxed" aria-live="polite">
          {value.trim().length === 0 ? null : outOfRange && offsetMs !== null ? (
            <span className="text-danger">
              {t('offsetOutOfRange', { offset: formatOffset(offsetMs) })}
            </span>
          ) : valid && playerMs !== null ? (
            <span className={unusual ? 'text-danger' : 'text-accent'}>
              {mode === 'calibrate' && offsetMs !== null
                ? `${t('calibratePreview', { offset: formatOffset(offsetMs) })}${
                    unusual ? `, ${t('offsetUnusual')}` : ''
                  }`
                : t('gotoPreview', { time: formatTimestamp(playerMs) })}
            </span>
          ) : (
            <span className="text-danger">{t('invalid')}</span>
          )}
        </p>

        <button
          type="submit"
          disabled={!valid}
          className="press min-h-14 rounded-xl bg-accent text-base font-semibold text-accent-ink disabled:opacity-40"
        >
          {mode === 'calibrate' ? t('calibrateAction') : t('gotoAction')}
        </button>
      </form>
    </BottomSheet>
  );
}
