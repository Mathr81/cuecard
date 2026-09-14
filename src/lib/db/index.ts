import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { optionalEnv } from '@/lib/env';

/** Sur le VPS, le fichier vit à côté de l'app ; en test, chaque suite a le sien. */
const DB_PATH = optionalEnv('CUECARD_DB_PATH') ?? path.join(process.cwd(), '.data', 'cuecard.db');

let instance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (instance) return instance;

  if (DB_PATH !== ':memory:') mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  instance = db;
  return db;
}

/** Exposé pour les tests, qui ouvrent une base jetable par suite. */
/**
 * Les sources sans clé identifient un fichier par une chaîne
 * (`opensubtitles:45899`, `shegu:…`) là où l'API v1 donnait un entier. Or un
 * `INTEGER PRIMARY KEY` est un alias de rowid : il refuse une chaîne. Le cache
 * étant, par nature, reconstructible, on jette l'ancienne table plutôt que de
 * transposer des identifiants qui n'ont plus cours.
 */
function dropLegacySubtitleCache(db: Database.Database): void {
  const columns = db.prepare(`PRAGMA table_info(subtitle_files)`).all() as Array<{
    name: string;
    type: string;
  }>;

  const fileId = columns.find((column) => column.name === 'file_id');
  if (fileId && fileId.type.toUpperCase() === 'INTEGER') {
    db.exec(`DROP TABLE subtitle_files`);
  }
}

export function createDatabase(file: string): Database.Database {
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  dropLegacySubtitleCache(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS titles (
      key            TEXT PRIMARY KEY,
      media_type     TEXT NOT NULL,
      tmdb_id        INTEGER NOT NULL,
      name           TEXT NOT NULL,
      year           INTEGER,
      poster_path    TEXT,
      season         INTEGER,
      episode        INTEGER,
      episode_name   TEXT,
      genres         TEXT NOT NULL DEFAULT '[]',
      imdb_id        TEXT,
      last_opened_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS titles_recent ON titles (last_opened_at DESC);

    -- Un fichier téléchargé chez OpenSubtitles ne l'est jamais deux fois : le
    -- quota journalier de téléchargements est la ressource la plus rare.
    CREATE TABLE IF NOT EXISTS subtitle_files (
      file_id      TEXT PRIMARY KEY,
      title_key    TEXT NOT NULL,
      release_name TEXT NOT NULL,
      content      TEXT NOT NULL,
      encoding     TEXT NOT NULL,
      format       TEXT NOT NULL,
      cue_count    INTEGER NOT NULL,
      fetched_at   INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS subtitle_files_title ON subtitle_files (title_key);

    -- Le carnet : un mot, la réplique d'où il vient, et ce qu'on en a compris.
    CREATE TABLE IF NOT EXISTS vocabulary (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      term             TEXT NOT NULL,
      cue_text         TEXT NOT NULL,
      title_key        TEXT NOT NULL,
      title_name       TEXT NOT NULL,
      episode_label    TEXT,
      start_ms         INTEGER NOT NULL,
      translation      TEXT,
      explanation      TEXT,
      register         TEXT,
      kind             TEXT,
      created_at       INTEGER NOT NULL,
      reviews          INTEGER NOT NULL DEFAULT 0,
      failures         INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at INTEGER
    );

    -- Le même mot, dans la même réplique du même titre, n'est qu'une entrée :
    -- resauvegarder met à jour au lieu de doubler.
    CREATE UNIQUE INDEX IF NOT EXISTS vocabulary_unique
      ON vocabulary (term, title_key, start_ms);

    CREATE INDEX IF NOT EXISTS vocabulary_recent ON vocabulary (created_at DESC);

    -- Une explication ne dépend que du mot et de son contexte : la recalculer
    -- coûterait des jetons pour un résultat identique.
    CREATE TABLE IF NOT EXISTS llm_senses (
      cache_key  TEXT PRIMARY KEY,
      term       TEXT NOT NULL,
      language   TEXT NOT NULL,
      model      TEXT NOT NULL,
      payload    TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Le décalage dépend du couple (titre, source) : deux versions de
    -- sous-titres du même épisode n'ont pas le même retard.
    CREATE TABLE IF NOT EXISTS offsets (
      title_key  TEXT NOT NULL,
      file_id    TEXT NOT NULL,
      offset_ms  INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (title_key, file_id)
    );
  `);
}
