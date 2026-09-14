export type ExternalErrorCode =
  | 'missing_key'
  | 'unauthorized'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'not_found'
  | 'invalid_response'
  | 'upstream'
  | 'network';

/** Une erreur qu'on saura expliquer à l'écran, pas une pile d'appels. */
export class ExternalApiError extends Error {
  constructor(
    readonly code: ExternalErrorCode,
    readonly detail?: string
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ExternalApiError';
  }
}

const STATUS_TO_CODE: Record<number, ExternalErrorCode> = {
  401: 'unauthorized',
  403: 'unauthorized',
  404: 'not_found',
  406: 'quota_exhausted',
  429: 'rate_limited',
};

export function codeForStatus(status: number): ExternalErrorCode {
  return STATUS_TO_CODE[status] ?? 'upstream';
}

/** Statut HTTP à renvoyer au navigateur pour chaque cas. */
export function statusForCode(code: ExternalErrorCode): number {
  switch (code) {
    case 'missing_key':
      return 503;
    case 'unauthorized':
      return 401;
    case 'rate_limited':
      return 429;
    case 'quota_exhausted':
      return 402;
    case 'not_found':
      return 404;
    case 'invalid_response':
      return 502;
    default:
      return 502;
  }
}
