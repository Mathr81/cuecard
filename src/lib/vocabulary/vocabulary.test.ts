import type { Database } from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/lib/db/index';
import { backSide, boldTerm, csvField, toAnkiCsv } from './anki';
import { failureRate, reviewOrder } from './sort';
import { deleteEntry, findEntry, listEntries, recordReview, saveEntry } from './repository';
import type { NewVocabularyEntry, VocabularyEntry } from './types';

function draft(overrides: Partial<NewVocabularyEntry> = {}): NewVocabularyEntry {
  return {
    term: 'blow this off',
    cueText: "Look, we can't just blow this off and hope nobody notices.",
    titleKey: 'tv:1396:1:4',
    titleName: 'Breaking Bad',
    episodeLabel: 'S01E04',
    startMs: 74_000,
    translation: 'laisser tomber ça',
    explanation: 'Ignorer un problème au lieu de l’affronter.',
    register: 'familier',
    kind: 'phrasal verb',
    ...overrides,
  };
}

function entry(overrides: Partial<VocabularyEntry> = {}): VocabularyEntry {
  return {
    id: 1,
    ...draft(),
    createdAt: 1000,
    reviews: 0,
    failures: 0,
    lastReviewedAt: null,
    ...overrides,
  };
}

describe('boldTerm', () => {
  it('bolds the word inside the film line', () => {
    expect(boldTerm('We just walk away?', 'walk')).toBe('We just <b>walk</b> away?');
  });

  it('finds the word whatever the case', () => {
    expect(boldTerm("Don't you dare.", "don't")).toBe("<b>Don't</b> you dare.");
  });

  it('escapes the HTML already in the line', () => {
    expect(boldTerm('a < b & c walk', 'walk')).toBe('a &lt; b &amp; c <b>walk</b>');
  });

  it('leaves the line intact when the word is not literally there', () => {
    expect(boldTerm('He went home.', 'going')).toBe('He went home.');
  });

  it('bolds a whole expression as one run, punctuation included', () => {
    expect(boldTerm("Don't blow this off, Frank.", 'blow this off')).toBe(
      "Don't <b>blow this off</b>, Frank."
    );
  });

  it('falls back to word by word when the expression is not contiguous', () => {
    expect(boldTerm('walk away, then run away', 'walk run')).toBe(
      '<b>walk</b> away, then <b>run</b> away'
    );
  });
});

describe('csvField', () => {
  it('leaves a plain field alone', () => {
    expect(csvField('hello')).toBe('hello');
  });

  it('quotes and doubles the quotes', () => {
    expect(csvField('say "hi", now')).toBe('"say ""hi"", now"');
  });
});

describe('toAnkiCsv', () => {
  it('writes two columns, front and back, with no header', () => {
    const csv = toAnkiCsv([entry()]);
    expect(csv.split('\r\n')).toHaveLength(1);
    expect(csv).toContain('<b>blow this off</b>');
    expect(csv).toContain('laisser tomber ça');
    expect(csv).toContain('Breaking Bad · S01E04 · 1:14');
  });

  it('survives an entry the LLM never explained', () => {
    const bare = entry({ translation: null, explanation: null, register: null, kind: null });
    expect(backSide(bare)).toBe('Breaking Bad · S01E04 · 1:14');
  });

  it('quotes a line containing a comma', () => {
    expect(toAnkiCsv([entry()]).startsWith('"')).toBe(true);
  });
});

describe('reviewOrder', () => {
  it('counts a never-reviewed word as fully failed, so it comes first', () => {
    expect(failureRate(entry({ reviews: 0, failures: 0 }))).toBe(1);
  });

  it('puts the most failed word first', () => {
    const often = entry({ id: 1, reviews: 4, failures: 3, lastReviewedAt: 500 });
    const rarely = entry({ id: 2, reviews: 4, failures: 1, lastReviewedAt: 500 });
    expect([rarely, often].sort(reviewOrder).map((item) => item.id)).toEqual([1, 2]);
  });

  it('at equal failure rate, the least recently reviewed comes first', () => {
    const old = entry({ id: 1, reviews: 2, failures: 1, lastReviewedAt: 100 });
    const recent = entry({ id: 2, reviews: 2, failures: 1, lastReviewedAt: 900 });
    expect([recent, old].sort(reviewOrder).map((item) => item.id)).toEqual([1, 2]);
  });
});

describe('vocabulary repository', () => {
  let db: Database;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  it('saves and finds an entry', () => {
    const saved = saveEntry(draft(), db);
    expect(saved).toMatchObject({ term: 'blow this off', titleName: 'Breaking Bad', reviews: 0 });
    expect(findEntry('blow this off', 'tv:1396:1:4', 74_000, db)?.id).toBe(saved.id);
  });

  it('does not duplicate the same word from the same line', () => {
    saveEntry(draft(), db);
    saveEntry(draft(), db);
    expect(listEntries({}, db)).toHaveLength(1);
  });

  it('fills in a translation obtained later without losing the review history', () => {
    const first = saveEntry(draft({ translation: null, explanation: null }), db);
    recordReview(first.id, false, db);
    const second = saveEntry(draft(), db);

    expect(second.translation).toBe('laisser tomber ça');
    expect(second.reviews).toBe(1);
    expect(second.failures).toBe(1);
  });

  it('keeps the same word saved from two different lines apart', () => {
    saveEntry(draft(), db);
    saveEntry(draft({ startMs: 99_000 }), db);
    expect(listEntries({}, db)).toHaveLength(2);
  });

  it('searches the word, the line and the translation', () => {
    saveEntry(draft(), db);
    saveEntry(
      draft({
        term: 'badge',
        startMs: 78_000,
        cueText: 'the guy with the badge',
        translation: 'la plaque',
      }),
      db
    );

    expect(listEntries({ query: 'badge' }, db)).toHaveLength(1);
    expect(listEntries({ query: 'nobody notices' }, db)).toHaveLength(1);
    expect(listEntries({ query: 'plaque' }, db)).toHaveLength(1);
    expect(listEntries({ query: 'zzz' }, db)).toHaveLength(0);
  });

  it('filters by title', () => {
    saveEntry(draft(), db);
    saveEntry(draft({ titleKey: 'movie:603', titleName: 'Matrix', episodeLabel: null }), db);
    expect(listEntries({ titleKey: 'movie:603' }, db).map((item) => item.titleName)).toEqual([
      'Matrix',
    ]);
  });

  it('records a review and counts the failures', () => {
    const saved = saveEntry(draft(), db);
    expect(recordReview(saved.id, true, db)).toMatchObject({ reviews: 1, failures: 0 });
    expect(recordReview(saved.id, false, db)).toMatchObject({ reviews: 2, failures: 1 });
    expect(recordReview(saved.id, true, db)?.lastReviewedAt).toBeGreaterThan(0);
  });

  it('removes an entry', () => {
    const saved = saveEntry(draft(), db);
    deleteEntry(saved.id, db);
    expect(listEntries({}, db)).toHaveLength(0);
  });
});
