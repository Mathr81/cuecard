'use client';

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { del, get, set } from 'idb-keyval';
import type { SubtitleDocument } from '@/lib/subtitles/types';

/**
 * Les répliques vivent dans IndexedDB et pas dans localStorage : un film fait
 * facilement 2000 répliques, et je veux retrouver ma session même après avoir
 * perdu le wifi ou fermé l'onglet au milieu du film.
 */
const indexedDbStorage: StateStorage = {
  getItem: async (name) => {
    if (typeof indexedDB === 'undefined') return null;
    return (await get<string>(name)) ?? null;
  },
  setItem: async (name, value) => {
    if (typeof indexedDB === 'undefined') return;
    await set(name, value);
  },
  removeItem: async (name) => {
    if (typeof indexedDB === 'undefined') return;
    await del(name);
  },
};

interface SubtitleState {
  document: SubtitleDocument | null;
  currentIndex: number;
  hydrated: boolean;
  loadDocument: (document: SubtitleDocument) => void;
  clearDocument: () => void;
  goTo: (index: number) => void;
  step: (delta: number) => void;
}

export const useSubtitleStore = create<SubtitleState>()(
  persist(
    (setState, getState) => ({
      document: null,
      currentIndex: 0,
      hydrated: false,

      loadDocument: (document) => setState({ document, currentIndex: 0 }),
      clearDocument: () => setState({ document: null, currentIndex: 0 }),

      goTo: (index) => {
        const cues = getState().document?.cues;
        if (!cues || cues.length === 0) return;
        setState({ currentIndex: clamp(index, 0, cues.length - 1) });
      },

      step: (delta) => {
        const state = getState();
        const cues = state.document?.cues;
        if (!cues || cues.length === 0) return;
        setState({ currentIndex: clamp(state.currentIndex + delta, 0, cues.length - 1) });
      },
    }),
    {
      name: 'cuecard.subtitles',
      storage: createJSONStorage(() => indexedDbStorage),
      partialize: (state) => ({ document: state.document, currentIndex: state.currentIndex }),
      // `hydrated` n'est pas persisté : il signale que la lecture asynchrone
      // d'IndexedDB est terminée, pour ne pas afficher « aucun fichier » une
      // fraction de seconde avant de retrouver la session en cours.
      onRehydrateStorage: () => () => {
        useSubtitleStore.setState({ hydrated: true });
      },
    }
  )
);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
