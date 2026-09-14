import type { Database } from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from './index';
import {
  cacheSubtitleFile,
  cachedSubtitleFile,
  clearOffset,
  forgetTitle,
  readOffset,
  recentTitles,
  rememberTitle,
  writeOffset,
} from './repository';
import { episodeLabel, titleKey } from '@/lib/titles/key';
import type { TitleRef } from '@/lib/titles/types';

function episode(season: number, number: number): TitleRef {
  return {
    mediaType: 'tv',
    tmdbId: 1396,
    name: 'Breaking Bad',
    year: 2008,
    posterPath: '/poster.jpg',
    season,
    episode: number,
    episodeName: `Episode ${number}`,
  };
}

const movie: TitleRef = {
  mediaType: 'movie',
  tmdbId: 603,
  name: 'The Matrix',
  year: 1999,
  posterPath: '/matrix.jpg',
  season: null,
  episode: null,
  episodeName: null,
};

describe('titleKey', () => {
  it('separates a movie from an episode', () => {
    expect(titleKey(movie)).toBe('movie:603');
    expect(titleKey(episode(1, 4))).toBe('tv:1396:1:4');
  });

  it('falls back to the show when season and episode are unknown', () => {
    expect(titleKey({ ...episode(1, 4), season: null, episode: null })).toBe('tv:1396');
  });

  it('labels episodes the way the files are named', () => {
    expect(episodeLabel(episode(1, 4))).toBe('S01E04');
    expect(episodeLabel(movie)).toBe('');
  });
});

describe('history', () => {
  let db: Database;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  it('lists the most recently opened first', () => {
    rememberTitle(movie, db);
    rememberTitle(episode(1, 4), db);
    expect(recentTitles(db).map((title) => title.name)).toEqual(['Breaking Bad', 'The Matrix']);
  });

  it('moves a title back to the top instead of duplicating it', () => {
    rememberTitle(movie, db);
    rememberTitle(episode(1, 4), db);
    rememberTitle(movie, db);

    const titles = recentTitles(db);
    expect(titles).toHaveLength(2);
    expect(titles[0].name).toBe('The Matrix');
  });

  it('keeps only the last ten', () => {
    for (let number = 1; number <= 14; number += 1) rememberTitle(episode(1, number), db);

    const titles = recentTitles(db);
    expect(titles).toHaveLength(10);
    expect(titles[0].episode).toBe(14);
    expect(titles.at(-1)?.episode).toBe(5);
  });

  it('keeps the episode details needed to display the entry', () => {
    rememberTitle(episode(2, 7), db);
    expect(recentTitles(db)[0]).toMatchObject({
      mediaType: 'tv',
      season: 2,
      episode: 7,
      episodeName: 'Episode 7',
      posterPath: '/poster.jpg',
    });
  });

  it('forgets a single title', () => {
    rememberTitle(movie, db);
    rememberTitle(episode(1, 4), db);
    forgetTitle(titleKey(movie), db);
    expect(recentTitles(db).map((title) => title.name)).toEqual(['Breaking Bad']);
  });
});

describe('subtitle cache', () => {
  let db: Database;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  it('stores and returns a downloaded file', () => {
    cacheSubtitleFile(
      {
        fileId: 42,
        titleKey: 'movie:603',
        releaseName: 'The.Matrix.1999.1080p',
        content: '1\n00:00:01,000 --> 00:00:02,000\nHello',
        encoding: 'utf-8',
        format: 'srt',
        cueCount: 1,
        fetchedAt: 1000,
      },
      db
    );

    expect(cachedSubtitleFile(42, db)).toMatchObject({
      fileId: 42,
      releaseName: 'The.Matrix.1999.1080p',
      cueCount: 1,
    });
  });

  it('returns nothing for a file never downloaded', () => {
    expect(cachedSubtitleFile(7, db)).toBeNull();
  });
});

describe('offsets', () => {
  let db: Database;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  it('remembers a calibration per title and per source', () => {
    writeOffset('tv:1396:1:4', '11', 12_000, db);
    writeOffset('tv:1396:1:4', '22', -3000, db);

    expect(readOffset('tv:1396:1:4', '11', db)).toBe(12_000);
    expect(readOffset('tv:1396:1:4', '22', db)).toBe(-3000);
    expect(readOffset('tv:1396:1:5', '11', db)).toBeNull();
  });

  it('overwrites a previous calibration', () => {
    writeOffset('movie:603', 'upload', 5000, db);
    writeOffset('movie:603', 'upload', 9000, db);
    expect(readOffset('movie:603', 'upload', db)).toBe(9000);
  });

  it('resets to nothing', () => {
    writeOffset('movie:603', 'upload', 5000, db);
    clearOffset('movie:603', 'upload', db);
    expect(readOffset('movie:603', 'upload', db)).toBeNull();
  });
});
