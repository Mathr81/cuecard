'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Faux côté serveur et au premier rendu : le mobile est la cible par défaut,
 * le desktop est le cas particulier qui s'annonce après hydratation.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
