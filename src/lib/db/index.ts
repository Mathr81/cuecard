import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/** Sur le VPS, le fichier vit à côté de l'app ; en test, chaque suite a le sien. */
const DB_PATH = process.env.CUECARD_DB_PATH ?? path.join(process.cwd(), '.data', 'cuecard.db');

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
export function createDatabase(file: string): Database.Database {
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
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
      last_opened_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS titles_recent ON titles (last_opened_at DESC);

    -- Un fichier téléchargé chez OpenSubtitles ne l'est jamais deux fois : le
    -- quota journalier de téléchargements est la ressource la plus rare.
    CREATE TABLE IF NOT EXISTS subtitle_files (
      file_id      INTEGER PRIMARY KEY,
      title_key    TEXT NOT NULL,
      release_name TEXT NOT NULL,
      content      TEXT NOT NULL,
      encoding     TEXT NOT NULL,
      format       TEXT NOT NULL,
      cue_count    INTEGER NOT NULL,
      fetched_at   INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS subtitle_files_title ON subtitle_files (title_key);

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
