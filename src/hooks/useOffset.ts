'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiSend } from '@/lib/api/client';

/**
 * Le décalage entre le fichier de sous-titres et le lecteur de streaming,
 * mémorisé côté serveur pour ce titre et cette source : on le cale une fois,
 * jamais deux.
 */
export function useOffset(titleKey: string | null, fileId: string | null) {
  const [offsetMs, setOffsetMs] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!titleKey || !fileId) return;

    const controller = new AbortController();
    apiGet<{ offsetMs: number | null }>(
      `/api/offset?titleKey=${encodeURIComponent(titleKey)}&fileId=${encodeURIComponent(fileId)}`,
      controller.signal
    )
      .then((data) => setOffsetMs(data.offsetMs ?? 0))
      // Le décalage est un confort : sans lui le mode texte marche toujours.
      .catch(() => undefined);

    return () => controller.abort();
  }, [titleKey, fileId]);

  const save = useCallback(
    (value: number) => {
      setOffsetMs(value);
      setSaveFailed(false);
      if (!titleKey || !fileId) return;

      // Le décalage reste appliqué pour cette session, mais on dit clairement
      // qu'il n'a pas été mémorisé plutôt que de laisser croire le contraire.
      void apiSend('/api/offset', 'PUT', { titleKey, fileId, offsetMs: value }).catch(() =>
        setSaveFailed(true)
      );
    },
    [titleKey, fileId]
  );

  const reset = useCallback(() => {
    setOffsetMs(0);
    setSaveFailed(false);
    if (!titleKey || !fileId) return;
    void apiSend(
      `/api/offset?titleKey=${encodeURIComponent(titleKey)}&fileId=${encodeURIComponent(fileId)}`,
      'DELETE'
    ).catch(() => undefined);
  }, [titleKey, fileId]);

  return { offsetMs, saveFailed, save, reset };
}
