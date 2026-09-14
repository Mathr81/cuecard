import 'server-only';
import { ExternalApiError } from '@/lib/external/errors';
import { fetchJson } from '@/lib/external/fetchJson';
import { buildMessages, type ChatMessage, type SenseRequest } from '@/lib/sense/prompt';
import type { TokenUsage } from './types';
import {
  extractJsonObject,
  normalizeSenseCandidate,
  senseSchema,
  type ContextualSense,
} from '@/lib/sense/schema';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** Un modèle rapide et bon marché par défaut ; OPENROUTER_MODEL le remplace. */
const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';

/** Une explication tient en quelques phrases : pas la peine de payer plus. */
const MAX_TOKENS = 700;

export interface SenseResult {
  sense: ContextualSense;
  usage: TokenUsage;
  model: string;
  /** 1 en temps normal, 2 quand la première réponse était hors contrat. */
  attempts: number;
}

export function senseModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
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

function parse(content: string): { sense: ContextualSense } | { error: string } {
  const candidate = extractJsonObject(content);
  if (candidate === null) return { error: 'the response was not a JSON object' };

  const parsed = senseSchema.safeParse(normalizeSenseCandidate(candidate));
  return parsed.success
    ? { sense: parsed.data }
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
 * Demande le sens en contexte. Une seule relance si la réponse ne respecte
 * pas le contrat : au-delà, le modèle ne s'y conformera pas et l'attente
 * devient plus coûteuse que l'absence de réponse.
 */
export async function requestSense(request: SenseRequest): Promise<SenseResult> {
  const model = senseModel();
  const messages = buildMessages(request);

  const first = await complete(messages, model);
  const parsed = parse(first.content);
  if ('sense' in parsed) {
    return { sense: parsed.sense, usage: first.usage, model: first.model, attempts: 1 };
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
  if ('sense' in second) {
    return { sense: second.sense, usage, model: retry.model, attempts: 2 };
  }

  throw new ExternalApiError('invalid_response', second.error);
}
