import { foldPreservingLength, highlightRanges, normalizeForSearch } from '@/lib/subtitles/search';
import { formatTimestamp } from '@/lib/time';
import type { VocabularyEntry } from './types';

/**
 * Met le mot en gras dans la phrase du film. Le repérage est le même que
 * celui de la recherche : insensible à la casse et aux accents, donc « Don't »
 * ressort même si j'ai sauvegardé « don't ».
 */
export function boldTerm(text: string, term: string): string {
  // Une expression doit ressortir d'un bloc : « blow this off » en gras, pas
  // trois mots gras séparés par des espaces maigres.
  const phrase = phraseRange(text, term);
  const ranges = phrase ? [phrase] : highlightRanges(text, term);
  if (ranges.length === 0) return escapeHtml(text);

  const parts: string[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    parts.push(escapeHtml(text.slice(cursor, start)));
    parts.push(`<b>${escapeHtml(text.slice(start, end))}</b>`);
    cursor = end;
  }
  parts.push(escapeHtml(text.slice(cursor)));
  return parts.join('');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** L'expression entière dans la réplique, en tolérant la ponctuation entre les
 *  mots : « blow this off, » reste une seule plage. */
function phraseRange(text: string, term: string): [number, number] | null {
  const words = normalizeForSearch(term).split(' ').filter(Boolean);
  if (words.length === 0) return null;

  const pattern = new RegExp(words.map(escapeRegExp).join('[^\\p{L}\\p{N}]+'), 'u');
  const found = pattern.exec(foldPreservingLength(text));
  return found ? [found.index, found.index + found[0].length] : null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Échappement RFC 4180 : guillemets doublés, champ encadré s'il le faut. */
export function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function source(entry: VocabularyEntry): string {
  return [entry.titleName, entry.episodeLabel, formatTimestamp(entry.startMs)]
    .filter(Boolean)
    .join(' · ');
}

/** Le verso : ce que le mot veut dire ici, pourquoi, et d'où il vient. */
export function backSide(entry: VocabularyEntry): string {
  const lines = [
    entry.translation,
    entry.explanation,
    [entry.register, entry.kind].filter(Boolean).join(' · ') || null,
    source(entry),
  ].filter((line): line is string => Boolean(line && line.trim()));

  return lines.join('<br>');
}

/**
 * Deux colonnes, recto et verso, sans en-tête : c'est ce qu'Anki attend d'un
 * CSV. Le gras suppose « Allow HTML in fields » à l'import.
 */
export function toAnkiCsv(entries: VocabularyEntry[]): string {
  return entries
    .map((entry) =>
      [
        csvField(boldTerm(entry.cueText.replace(/\n/g, ' '), entry.term)),
        csvField(backSide(entry)),
      ].join(',')
    )
    .join('\r\n');
}
