import type { Database } from 'better-sqlite3';
import { getDatabase } from '@/lib/db/index';
import type { TokenUsage } from '@/lib/openrouter/types';

export interface UsageTotals extends TokenUsage {
  /** Appels réellement facturés. */
  calls: number;
  /** Appels servis par le cache, donc gratuits. */
  cachedCalls: number;
  /** Date du premier appel compté, ou null si le journal est vide. */
  since: number | null;
}

export function recordUsage(
  entry: { model: string; usage: TokenUsage; cached: boolean },
  db: Database = getDatabase()
): void {
  db.prepare(
    `INSERT INTO llm_usage (model, prompt_tokens, completion_tokens, total_tokens, cached, created_at)
     VALUES (@model, @promptTokens, @completionTokens, @totalTokens, @cached, @createdAt)`
  ).run({
    model: entry.model,
    promptTokens: entry.usage.promptTokens,
    completionTokens: entry.usage.completionTokens,
    totalTokens: entry.usage.totalTokens,
    cached: entry.cached ? 1 : 0,
    createdAt: Date.now(),
  });
}

export function usageTotals(db: Database = getDatabase()): UsageTotals {
  const row = db
    .prepare(
      `SELECT
         IFNULL(SUM(prompt_tokens), 0)     AS prompt_tokens,
         IFNULL(SUM(completion_tokens), 0) AS completion_tokens,
         IFNULL(SUM(total_tokens), 0)      AS total_tokens,
         IFNULL(SUM(1 - cached), 0)        AS calls,
         IFNULL(SUM(cached), 0)            AS cached_calls,
         MIN(created_at)                   AS since
       FROM llm_usage`
    )
    .get() as {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    calls: number;
    cached_calls: number;
    since: number | null;
  };

  return {
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    calls: row.calls,
    cachedCalls: row.cached_calls,
    since: row.since,
  };
}

export function clearUsage(db: Database = getDatabase()): void {
  db.prepare(`DELETE FROM llm_usage`).run();
}
