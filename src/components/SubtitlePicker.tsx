'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ExternalError } from '@/components/ExternalError';
import { ApiError, apiSend, type ApiErrorCode } from '@/lib/api/client';
import type { SubtitleDocument } from '@/lib/subtitles/types';
import type { SubtitleCandidate } from '@/lib/subtitles/providers/types';
import type { TitleRef } from '@/lib/titles/types';
import { useSubtitleStore } from '@/store/subtitles';

interface SearchResponse {
  candidates: SubtitleCandidate[];
  failedProviders: string[];
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; candidates: SubtitleCandidate[]; failedProviders: string[] }
  | { status: 'error'; code: ApiErrorCode };

export function SubtitlePicker({ title }: { title: TitleRef }) {
  const t = useTranslations('subtitles');
  const router = useRouter();
  const loadDocument = useSubtitleStore((state) => state.loadDocument);

  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<ApiErrorCode | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    apiSend<SearchResponse>('/api/subtitles/search', 'POST', title, controller.signal)
      .then((data) =>
        setState({
          status: 'ready',
          candidates: data.candidates,
          failedProviders: data.failedProviders,
        })
      )
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', code: cause instanceof ApiError ? cause.code : 'upstream' });
      });

    return () => controller.abort();
  }, [title, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  async function choose(candidate: SubtitleCandidate) {
    setDownloading(candidate.id);
    setDownloadError(null);

    try {
      const data = await apiSend<{ document: SubtitleDocument }>(
        '/api/subtitles/download',
        'POST',
        { title, candidate }
      );
      loadDocument(data.document);
      router.push('/reader');
    } catch (cause) {
      setDownloadError(cause instanceof ApiError ? cause.code : 'upstream');
      setDownloading(null);
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-2" aria-live="polite">
        <p className="px-1 text-sm text-dim">{t('searching')}</p>
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-20 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <ExternalError code={state.code} service="OpenSubtitles" onRetry={retry} />
        <UploadFallback />
      </div>
    );
  }

  if (state.candidates.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-surface px-4 py-4">
          <p className="text-sm leading-relaxed text-muted">{t('none')}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-dim">{t('noneHint')}</p>
        </div>
        <UploadFallback />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Une source muette se dit, plutôt que de laisser croire que la liste
          est complète. */}
      {state.failedProviders.length > 0 ? (
        <p className="rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed text-muted">
          {t('sourceFailed', {
            sources: state.failedProviders.map((id) => t(`provider.${id}`)).join(', '),
          })}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {state.candidates.map((candidate, rank) => (
          <li key={candidate.id}>
            <button
              type="button"
              disabled={downloading !== null}
              onClick={() => void choose(candidate)}
              className="press flex min-h-20 w-full flex-col justify-center gap-1.5 rounded-xl bg-surface px-4 py-3 text-left active:bg-surface-high disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                {rank === 0 ? (
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
                    {t('best')}
                  </span>
                ) : null}
                <span className="truncate text-sm font-medium text-ink">
                  {candidate.releaseName}
                </span>
              </span>
              <span className="text-xs text-dim">
                {/* shegu ne compte pas les téléchargements : mieux vaut ne rien
                    afficher que d'inventer un zéro trompeur. */}
                {candidate.downloadCount !== null
                  ? `${t('downloads', { count: candidate.downloadCount })} · `
                  : ''}
                {t(`provider.${candidate.provider}`)}
              </span>
              {downloading === candidate.id ? (
                <span className="text-xs text-accent">{t('downloading')}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {downloadError ? (
        <ExternalError code={downloadError} service="OpenSubtitles" onRetry={retry} />
      ) : null}
      {downloadError ? <UploadFallback /> : null}
    </div>
  );
}

/** Quota épuisé ou API muette : il reste toujours le fichier chargé à la main. */
function UploadFallback() {
  const t = useTranslations('subtitles');

  return (
    <Link
      href="/?upload=1"
      className="press flex min-h-14 items-center justify-center rounded-xl bg-surface px-4 text-sm font-semibold text-ink"
    >
      {t('uploadInstead')}
    </Link>
  );
}
