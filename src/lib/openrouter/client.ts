import 'server-only';
import type { z } from 'zod';
import { envOr } from '@/lib/env';
import { ExternalApiError } from '@/lib/external/errors';
import { fetchJson } from '@/lib/external/fetchJson';
import { buildMessages, type ChatMessage, type SenseRequest } from '@/lib/sense/prompt';
import { buildEntryMessages, type WordEntryRequest } from '@/lib/sense/entryPrompt';
import { normalizeEntryCandidate, wordEntrySchema, type WordEntry } from '@/lib/sense/entry';
import type { TokenUsage } from './types';
import {
  extractJsonObject,
  normalizeSenseCandidate,
  senseSchema,
  type ContextualSense,
} from '@/lib/sense/schema';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** Un modèle rapide et bon marché par défaut ; OPENROUTER_MODEL le remplace.
 *  Les identifiants OpenRouter disparaissent quand un modèle est retiré : les
 *  réglages affichent celui qui sert et son tarif, pour le voir tout de suite. */
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';

/** Une explication tient en quelques phrases : pas la peine de payer plus. */
const MAX_TOKENS = 700;

export interface SenseResult {
  sense: ContextualSense;
  usage: TokenUsage;
  model: string;
  /** 1 en temps normal, 2 quand la première réponse était hors contrat. */
  attempts: number;
}

export interface WordEntryResult {
  entry: WordEntry;
  usage: TokenUsage;
  model: string;
  attempts: number;
}

export function senseModel(): string {
  return envOr('OPENROUTER_MODEL', DEFAULT_MODEL);
}

interface CompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  model?: string;
}

function headers(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new ExternalApiError('missing_key', 'OPENROUTER_API_KEY');

  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    // OpenRouter recommande d'identifier l'application appelante.
    'HTTP-Referer': 'https://github.com/Mathr81/cuecard',
    'X-Title': 'cuecard',
  };
}

async function complete(
  messages: ChatMessage[],
  model: string
): Promise<{ content: string; usage: TokenUsage; model: string }> {
  const data = await fetchJson<CompletionResponse>(ENDPOINT, {
    method: 'POST',
    headers: headers(),
    timeoutMs: 25_000,
    body: JSON.stringify({
      model,
      messages,
      // Une explication de sens n'a pas à être créative.
      temperature: 0.2,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
    }),
  });

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new ExternalApiError('invalid_response', 'empty completion');
  }

  return {
    content,
    model: data.model ?? model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

/** Une réponse conforme, ou la raison précise du refus, celle qu'on renvoie
 *  au modèle pour sa seule relance. */
type Parsed<T> = { value: T } | { error: string };

function parseWith<T>(
  content: string,
  normalize: (value: unknown) => unknown,
  schema: z.ZodType<T>
): Parsed<T> {
  const candidate = extractJsonObject(content);
  if (candidate === null) return { error: 'the response was not a JSON object' };

  const parsed = schema.safeParse(normalize(candidate));
  return parsed.success
    ? { value: parsed.data }
    : {
        error: parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
      };
}

function sum(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

/**
 * Un aller-retour, avec une seule relance si la réponse ne respecte pas le
 * contrat : au-delà, le modèle ne s'y conformera pas et l'attente devient plus
 * coûteuse que l'absence de réponse.
 */
async function requestJson<T>(
  messages: ChatMessage[],
  parse: (content: string) => Parsed<T>
): Promise<{ value: T; usage: TokenUsage; model: string; attempts: number }> {
  const model = senseModel();

  const first = await complete(messages, model);
  const parsed = parse(first.content);
  if ('value' in parsed) {
    return { value: parsed.value, usage: first.usage, model: first.model, attempts: 1 };
  }

  const retry = await complete(
    [
      ...messages,
      {
        role: 'user',
        content: `Your previous answer was rejected (${parsed.error}). Answer again with only the JSON object described above.`,
      },
    ],
    model
  );

  const second = parse(retry.content);
  const usage = sum(first.usage, retry.usage);
  if ('value' in second) {
    return { value: second.value, usage, model: retry.model, attempts: 2 };
  }

  throw new ExternalApiError('invalid_response', second.error);
}

/** Le sens de l'expression dans cette scène-là. */
export async function requestSense(request: SenseRequest): Promise<SenseResult> {
  const { value, ...rest } = await requestJson(buildMessages(request), (content) =>
    parseWith(content, normalizeSenseCandidate, senseSchema)
  );
  return { sense: value, ...rest };
}

/** L'entrée bilingue générale du mot, celle qui s'apprend. */
export async function requestWordEntry(request: WordEntryRequest): Promise<WordEntryResult> {
  const { value, ...rest } = await requestJson(buildEntryMessages(request), (content) =>
    parseWith(content, normalizeEntryCandidate, wordEntrySchema)
  );
  return { entry: value, ...rest };
}
