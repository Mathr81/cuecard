import type { Database } from 'better-sqlite3';
import { getDatabase } from '@/lib/db/index';
import type { NewVocabularyEntry, VocabularyEntry } from './types';

interface Row {
  id: number;
  term: string;
  cue_text: string;
  title_key: string;
  title_name: string;
  episode_label: string | null;
  start_ms: number;
  translation: string | null;
  explanation: string | null;
  register: string | null;
  kind: string | null;
  created_at: number;
  reviews: number;
  failures: number;
  last_reviewed_at: number | null;
}

function toEntry(row: Row): VocabularyEntry {
  return {
    id: row.id,
    term: row.term,
    cueText: row.cue_text,
    titleKey: row.title_key,
    titleName: row.title_name,
    episodeLabel: row.episode_label,
    startMs: row.start_ms,
    translation: row.translation,
    explanation: row.explanation,
    register: row.register,
    kind: row.kind,
    createdAt: row.created_at,
    reviews: row.reviews,
    failures: row.failures,
    lastReviewedAt: row.last_reviewed_at,
  };
}

export function saveEntry(
  entry: NewVocabularyEntry,
  db: Database = getDatabase()
): VocabularyEntry {
  // Resauvegarder le même mot depuis la même réplique enrichit l'entrée avec
  // la traduction obtenue entre-temps, sans remettre les compteurs à zéro.
  db.prepare(
    `INSERT INTO vocabulary (term, cue_text, title_key, title_name, episode_label, start_ms,
                             translation, explanation, register, kind, created_at)
     VALUES (@term, @cueText, @titleKey, @titleName, @episodeLabel, @startMs,
             @translation, @explanation, @register, @kind, @createdAt)
     ON CONFLICT(term, title_key, start_ms) DO UPDATE SET
       cue_text = excluded.cue_text,
       title_name = excluded.title_name,
       episode_label = excluded.episode_label,
       translation = COALESCE(excluded.translation, translation),
       explanation = COALESCE(excluded.explanation, explanation),
       register = COALESCE(excluded.register, register),
       kind = COALESCE(excluded.kind, kind)`
  ).run({ ...entry, createdAt: Date.now() });

  const saved = findEntry(entry.term, entry.titleKey, entry.startMs, db);
  if (!saved) throw new Error('vocabulary entry vanished right after being written');
  return saved;
}

export function findEntry(
  term: string,
  titleKey: string,
  startMs: number,
  db: Database = getDatabase()
): VocabularyEntry | null {
  const row = db
    .prepare(`SELECT * FROM vocabulary WHERE term = ? AND title_key = ? AND start_ms = ?`)
    .get(term, titleKey, startMs) as Row | undefined;
  return row ? toEntry(row) : null;
}

export function listEntries(
  filters: { query?: string; titleKey?: string } = {},
  db: Database = getDatabase()
): VocabularyEntry[] {
  const clauses: string[] = [];
  const params: Record<string, string> = {};

  if (filters.titleKey) {
    clauses.push('title_key = @titleKey');
    params.titleKey = filters.titleKey;
  }
  if (filters.query && filters.query.trim().length > 0) {
    // La recherche porte aussi sur la réplique et la traduction : on retrouve
    // souvent un mot par la phrase où on l'a croisé.
    clauses.push('(term LIKE @like OR cue_text LIKE @like OR translation LIKE @like)');
    params.like = `%${filters.query.trim()}%`;
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM vocabulary ${where} ORDER BY created_at DESC`)
    .all(params) as Row[];
  return rows.map(toEntry);
}

export function deleteEntry(id: number, db: Database = getDatabase()): void {
  db.prepare(`DELETE FROM vocabulary WHERE id = ?`).run(id);
}

export function recordReview(
  id: number,
  known: boolean,
  db: Database = getDatabase()
): VocabularyEntry | null {
  db.prepare(
    `UPDATE vocabulary
        SET reviews = reviews + 1,
            failures = failures + @failed,
            last_reviewed_at = @now
      WHERE id = @id`
  ).run({ id, failed: known ? 0 : 1, now: Date.now() });

  const row = db.prepare(`SELECT * FROM vocabulary WHERE id = ?`).get(id) as Row | undefined;
  return row ? toEntry(row) : null;
}
