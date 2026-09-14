import { describe, expect, it } from 'vitest';
import { estimateCostUsd } from './cost';
import { findPricing } from './pricing';

const payload = {
  data: [
    { id: 'autre/modele', name: 'Autre', pricing: { prompt: '0.000001', completion: '0.000002' } },
    {
      id: 'google/gemini-2.5-flash-lite',
      name: 'Google: Gemini 2.5 Flash Lite',
      pricing: { prompt: '0.0000001', completion: '0.0000004' },
    },
  ],
};

describe('findPricing', () => {
  it('retrouve le tarif du modèle demandé', () => {
    expect(findPricing(payload, 'google/gemini-2.5-flash-lite')).toEqual({
      model: 'google/gemini-2.5-flash-lite',
      displayName: 'Google: Gemini 2.5 Flash Lite',
      promptUsdPerToken: 0.0000001,
      completionUsdPerToken: 0.0000004,
    });
  });

  it('rend null pour un modèle absent : c’est le signal qu’il a été retiré', () => {
    expect(findPricing(payload, 'google/gemini-2.0-flash-001')).toBeNull();
  });

  it('rend null quand le tarif est inexploitable', () => {
    expect(findPricing({ data: [{ id: 'x', pricing: { prompt: 'gratuit' } }] }, 'x')).toBeNull();
    expect(findPricing({ data: [{ id: 'x' }] }, 'x')).toBeNull();
  });

  it('encaisse une réponse qui n’a pas la forme attendue', () => {
    expect(findPricing(null, 'x')).toBeNull();
    expect(findPricing({ data: 'nope' }, 'x')).toBeNull();
  });
});

describe('estimateCostUsd', () => {
  const pricing = {
    model: 'm',
    displayName: 'M',
    promptUsdPerToken: 0.0000001,
    completionUsdPerToken: 0.0000004,
  };

  it('additionne entrée et sortie à leurs tarifs respectifs', () => {
    // 612 jetons en entrée et 184 en sortie : le coût réel d'une consultation.
    expect(
      estimateCostUsd({ promptTokens: 612, completionTokens: 184, totalTokens: 796 }, pricing)
    ).toBeCloseTo(0.0001348, 9);
  });

  it('vaut zéro sans consommation', () => {
    expect(estimateCostUsd({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }, pricing)).toBe(
      0
    );
  });
});
