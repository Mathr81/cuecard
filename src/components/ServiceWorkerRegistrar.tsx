'use client';

import { useEffect } from 'react';

/** En développement, un worker qui met en cache la coquille ne fait que
 *  masquer les changements : on ne l'installe qu'en production. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  return null;
}
