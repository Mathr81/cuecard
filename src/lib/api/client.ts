export const EXTERNAL_ERROR_CODES = [
  'missing_key',
  'unauthorized',
  'rate_limited',
  'quota_exhausted',
  'not_found',
  'invalid_response',
  'upstream',
  'network',
  'invalid_request',
] as const;

export type ApiErrorCode = (typeof EXTERNAL_ERROR_CODES)[number];

export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode) {
    super(code);
    this.name = 'ApiError';
  }
}

function toCode(value: unknown): ApiErrorCode {
  return (EXTERNAL_ERROR_CODES as readonly string[]).includes(String(value))
    ? (value as ApiErrorCode)
    : 'upstream';
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError('network');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    throw new ApiError(toCode(body?.error));
  }

  return (await response.json()) as T;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal });
}

export function apiSend<T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  return request<T>(path, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
