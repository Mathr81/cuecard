'use client';

import { useTranslations } from 'next-intl';
import type { ApiErrorCode } from '@/lib/api/client';

/**
 * Jamais d'écran blanc : chaque panne dit ce qui s'est passé, chez qui, et ce
 * qu'on peut faire : réessayer, ou charger un .srt à la main.
 */
export function ExternalError({
  code,
  service,
  onRetry,
}: {
  code: ApiErrorCode;
  service: string;
  onRetry?: () => void;
}) {
  const t = useTranslations('errors');

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-4"
    >
      <p className="text-sm leading-relaxed text-danger">{t(`external.${code}`, { service })}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="press min-h-11 self-start rounded-xl border border-danger/40 px-4 text-sm font-semibold text-danger"
        >
          {t('retry')}
        </button>
      ) : null}
    </div>
  );
}
