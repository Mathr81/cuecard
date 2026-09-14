import { cleanCueText } from './clean';
import { mergeOverlappingCues } from './merge';
import { isPromoCue } from './promo';
import type { Cue } from './types';

export interface ParseResult {
  format: 'srt' | 'vtt';
  cues: Cue[];
  /** Blocs ignorés : vides après nettoyage, ou publicité de la source. */
  skipped: number;
}

const TIMING =
  /(?:(\d{1,4}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})\s*-{1,3}>\s*(?:(\d{1,4}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/;

function toMs(h: string | undefined, m: string, s: string, frac: string): number {
  const ms = Number(frac.padEnd(3, '0').slice(0, 3));
  return Number(h ?? 0) * 3600_000 + Number(m) * 60_000 + Number(s) * 1000 + ms;
}

function matchTiming(line: string): { startMs: number; endMs: number } | null {
  const m = TIMING.exec(line);
  if (!m) return null;
  return {
    startMs: toMs(m[1], m[2], m[3], m[4]),
    endMs: toMs(m[5], m[6], m[7], m[8]),
  };
}

interface RawCue {
  startMs: number;
  endMs: number;
  lines: string[];
}

/**
 * Parse un .srt ou un .vtt. L'analyse est faite ligne à ligne plutôt que par
 * blocs séparés de lignes vides : les fichiers réels ont des lignes vides au
 * milieu d'une réplique, des numéros manquants, ou pas de séparateur du tout.
 */
export function parseSubtitles(text: string): ParseResult {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const format: 'srt' | 'vtt' = /^\s*WEBVTT/.test(normalized) ? 'vtt' : 'srt';
  const lines = normalized.split('\n');

  const raw: RawCue[] = [];
  let current: RawCue | null = null;
  let insideMetadataBlock = false;

  const flush = () => {
    if (!current) return;
    // Le numéro de la réplique suivante a été aspiré par la précédente : on le rend.
    while (current.lines.length > 0 && current.lines[current.lines.length - 1].trim() === '') {
      current.lines.pop();
    }
    const last = current.lines[current.lines.length - 1];
    if (last !== undefined && /^\d{1,6}$/.test(last.trim())) current.lines.pop();
    raw.push(current);
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (insideMetadataBlock) {
      if (trimmed === '') insideMetadataBlock = false;
      continue;
    }

    const timing = matchTiming(line);
    if (timing) {
      flush();
      current = { startMs: timing.startMs, endMs: timing.endMs, lines: [] };
      continue;
    }

    // NOTE / STYLE / REGION des VTT : métadonnées, jamais du texte à lire.
    if (/^(NOTE|STYLE|REGION)\b/.test(trimmed)) {
      insideMetadataBlock = true;
      continue;
    }

    if (current) current.lines.push(line);
  }
  flush();

  let skipped = 0;
  const cues: Cue[] = [];
  for (const item of raw) {
    const cleaned = cleanCueText(item.lines.join('\n'));
    if (cleaned.length === 0 || isPromoCue(cleaned)) {
      skipped += 1;
      continue;
    }
    // Certains fichiers ont une fin antérieure au début : on force une durée mini.
    const endMs = item.endMs > item.startMs ? item.endMs : item.startMs + 1000;
    cues.push({ index: cues.length, startMs: item.startMs, endMs, text: cleaned });
  }

  return { format, cues: mergeOverlappingCues(cues), skipped };
}
