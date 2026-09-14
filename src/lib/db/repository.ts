import type { Database } from 'better-sqlite3';
import { getDatabase } from './index';
import { titleKey } from '@/lib/titles/key';
import type { RecentTitle, TitleRef } from '@/lib/titles/types';

/** Je regarde souvent plusieurs épisodes d'affilée : dix suffit largement. */
const HISTORY_SIZE = 10;

interface TitleRow {
  key: string;
  media_type: string;
  tmdb_id: number;
  name: string;
  year: number | null;
  poster_path: string | null;
  season: number | null;
  episode: number | null;
  episode_name: string | null;
  last_opened_at: number;
}

function toRecentTitle(row: TitleRow): RecentTitle {
  return {
    mediaType: row.media_type === 'tv' ? 'tv' : 'movie',
    tmdbId: row.tmdb_id,
    name: row.name,
    year: row.year,
    posterPath: row.poster_path,
    season: row.season,
    episode: row.episode,
    episodeName: row.episode_name,
    lastOpenedAt: row.last_opened_at,
  };
}

export function rememberTitle(ref: TitleRef, db: Database = getDatabase()): void {
  // L'horodatage est forcé strictement croissant : deux titres ouverts dans la
  // même milliseconde s'ordonneraient sinon au hasard, et le nettoyage
  // ci-dessous pourrait supprimer celui qu'on vient d'insérer.
  db.prepare(
    `INSERT INTO titles (key, media_type, tmdb_id, name, year, poster_path, season, episode, episode_name, last_opened_at)
     VALUES (@key, @mediaType, @tmdbId, @name, @year, @posterPath, @season, @episode, @episodeName,
             MAX(@now, IFNULL((SELECT MAX(last_opened_at) FROM titles), 0) + 1))
     ON CONFLICT(key) DO UPDATE SET
       name = excluded.name,
       year = excluded.year,
       poster_path = excluded.poster_path,
       episode_name = excluded.episode_name,
       last_opened_at = excluded.last_opened_at`
  ).run({ ...ref, key: titleKey(ref), now: Date.now() });

  // L'historique se taille tout seul plutôt que de grandir indéfiniment.
  db.prepare(
    `DELETE FROM titles WHERE key NOT IN (
       SELECT key FROM titles ORDER BY last_opened_at DESC LIMIT ?
     )`
  ).run(HISTORY_SIZE);
}

export function recentTitles(db: Database = getDatabase()): RecentTitle[] {
  const rows = db
    .prepare(`SELECT * FROM titles ORDER BY last_opened_at DESC LIMIT ?`)
    .all(HISTORY_SIZE) as TitleRow[];
  return rows.map(toRecentTitle);
}

export function forgetTitle(key: string, db: Database = getDatabase()): void {
  db.prepare(`DELETE FROM titles WHERE key = ?`).run(key);
}

export interface CachedSubtitleFile {
  fileId: number;
  titleKey: string;
  releaseName: string;
  content: string;
  encoding: string;
  format: string;
  cueCount: number;
  fetchedAt: number;
}

export function cachedSubtitleFile(
  fileId: number,
  db: Database = getDatabase()
): CachedSubtitleFile | null {
  const row = db.prepare(`SELECT * FROM subtitle_files WHERE file_id = ?`).get(fileId) as
    Record<string, string | number> | undefined;
  if (!row) return null;

  return {
    fileId: Number(row.file_id),
    titleKey: String(row.title_key),
    releaseName: String(row.release_name),
    content: String(row.content),
    encoding: String(row.encoding),
    format: String(row.format),
    cueCount: Number(row.cue_count),
    fetchedAt: Number(row.fetched_at),
  };
}

export function cacheSubtitleFile(file: CachedSubtitleFile, db: Database = getDatabase()): void {
  db.prepare(
    `INSERT INTO subtitle_files (file_id, title_key, release_name, content, encoding, format, cue_count, fetched_at)
     VALUES (@fileId, @titleKey, @releaseName, @content, @encoding, @format, @cueCount, @fetchedAt)
     ON CONFLICT(file_id) DO UPDATE SET
       content = excluded.content,
       release_name = excluded.release_name,
       cue_count = excluded.cue_count,
       fetched_at = excluded.fetched_at`
  ).run(file);
}

export function readOffset(
  key: string,
  fileId: string,
  db: Database = getDatabase()
): number | null {
  const row = db
    .prepare(`SELECT offset_ms FROM offsets WHERE title_key = ? AND file_id = ?`)
    .get(key, fileId) as { offset_ms: number } | undefined;
  return row ? row.offset_ms : null;
}

export function writeOffset(
  key: string,
  fileId: string,
  offsetMs: number,
  db: Database = getDatabase()
): void {
  db.prepare(
    `INSERT INTO offsets (title_key, file_id, offset_ms, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(title_key, file_id) DO UPDATE SET
       offset_ms = excluded.offset_ms,
       updated_at = excluded.updated_at`
  ).run(key, fileId, Math.round(offsetMs), Date.now());
}

export function clearOffset(key: string, fileId: string, db: Database = getDatabase()): void {
  db.prepare(`DELETE FROM offsets WHERE title_key = ? AND file_id = ?`).run(key, fileId);
}
