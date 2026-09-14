'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TokenUsage } from '@/lib/openrouter/types';

interface TokenState {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Appels réellement payés, et ceux servis par le cache. */
  calls: number;
  cachedCalls: number;
  since: number;
  record: (usage: TokenUsage, cached: boolean) => void;
  reset: () => void;
}

const EMPTY = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  calls: 0,
  cachedCalls: 0,
};

/** Savoir ce que la session a coûté évite les mauvaises surprises en fin de mois. */
export const useTokenStore = create<TokenState>()(
  persist(
    (setState) => ({
      ...EMPTY,
      since: Date.now(),

      record: (usage, cached) =>
        setState((state) =>
          cached
            ? { cachedCalls: state.cachedCalls + 1 }
            : {
                promptTokens: state.promptTokens + usage.promptTokens,
                completionTokens: state.completionTokens + usage.completionTokens,
                totalTokens: state.totalTokens + usage.totalTokens,
                calls: state.calls + 1,
              }
        ),

      reset: () => setState({ ...EMPTY, since: Date.now() }),
    }),
    {
      name: 'cuecard.tokens',
      storage: createJSONStorage(() =>
        typeof localStorage === 'undefined' ? undefinedStorage : localStorage
      ),
    }
  )
);

/** Côté serveur il n'y a rien à lire ni à écrire, mais l'interface doit exister. */
const undefinedStorage: Storage = {
  length: 0,
  clear: () => undefined,
  getItem: () => null,
  key: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};
