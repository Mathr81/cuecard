'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * Faux pendant le rendu serveur et le premier rendu client, vrai ensuite.
 *
 * Sert à ne pas afficher une valeur qui n'existe que dans le navigateur — un
 * compteur rangé dans localStorage, par exemple. Le serveur rendrait zéro, le
 * client la vraie valeur, et React signalerait une divergence d'hydratation.
 * `useSyncExternalStore` donne ce drapeau sans écrire d'état dans un effet.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
