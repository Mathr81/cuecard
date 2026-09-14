import type { TokenUsage } from './types';

export interface ModelPricing {
  /** Identifiant tel qu'OpenRouter le connaît. */
  model: string;
  displayName: string;
  /** Prix en dollars par jeton — c'est l'unité qu'emploie OpenRouter. */
  promptUsdPerToken: number;
  completionUsdPerToken: number;
}

/** Ce que les jetons consommés ont coûté, en dollars. Calcul pur : il sert
 *  aussi bien au rendu serveur qu'au compteur côté navigateur. */
export function estimateCostUsd(usage: TokenUsage, pricing: ModelPricing): number {
  return (
    usage.promptTokens * pricing.promptUsdPerToken +
    usage.completionTokens * pricing.completionUsdPerToken
  );
}
