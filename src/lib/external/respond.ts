import { NextResponse } from 'next/server';
import { ExternalApiError, statusForCode, type ExternalErrorCode } from './errors';

/**
 * Le client ne reçoit qu'un code : il a ses propres messages, et le détail
 * d'une erreur amont n'a rien à faire dans le navigateur.
 */
export function errorResponse(cause: unknown): NextResponse {
  const error =
    cause instanceof ExternalApiError ? cause : new ExternalApiError('upstream', String(cause));
  console.error('[cuecard]', error.code, error.detail ?? '');
  return NextResponse.json({ error: error.code }, { status: statusForCode(error.code) });
}

export function badRequest(code: ExternalErrorCode | 'invalid_request' = 'invalid_request') {
  return NextResponse.json({ error: code }, { status: 400 });
}
