import type { Database } from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/lib/db/index';
import { clearUsage, recordUsage, usageTotals } from './repository';

describe('journal de consommation', () => {
  let db: Database;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  it('part de zéro, sans date', () => {
    expect(usageTotals(db)).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      calls: 0,
      cachedCalls: 0,
      since: null,
    });
  });

  it('additionne les appels payés', () => {
    recordUsage(
      {
        model: 'm',
        usage: { promptTokens: 612, completionTokens: 184, totalTokens: 796 },
        cached: false,
      },
      db
    );
    recordUsage(
      {
        model: 'm',
        usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
        cached: false,
      },
      db
    );

    expect(usageTotals(db)).toMatchObject({
      promptTokens: 712,
      completionTokens: 204,
      totalTokens: 916,
      calls: 2,
      cachedCalls: 0,
    });
  });

  it('compte les appels servis par le cache à part, et sans jetons', () => {
    recordUsage(
      {
        model: 'm',
        usage: { promptTokens: 612, completionTokens: 184, totalTokens: 796 },
        cached: false,
      },
      db
    );
    recordUsage(
      { model: 'm', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, cached: true },
      db
    );

    expect(usageTotals(db)).toMatchObject({ totalTokens: 796, calls: 1, cachedCalls: 1 });
  });

  it('retient la date du premier appel', () => {
    recordUsage(
      {
        model: 'm',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        cached: false,
      },
      db
    );
    expect(usageTotals(db).since).toBeGreaterThan(0);
  });

  it('se remet à zéro', () => {
    recordUsage(
      {
        model: 'm',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        cached: false,
      },
      db
    );
    clearUsage(db);
    expect(usageTotals(db)).toMatchObject({ totalTokens: 0, calls: 0, since: null });
  });
});
