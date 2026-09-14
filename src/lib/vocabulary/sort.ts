import type { VocabularyEntry } from './types';

/** Un mot jamais revu est prioritaire sur un mot su trois fois de suite. */
export function failureRate(entry: VocabularyEntry): number {
  return entry.reviews === 0 ? 1 : entry.failures / entry.reviews;
}

/**
 * L'ordre de révision : d'abord ce que je rate le plus, puis ce que je n'ai
 * pas revu depuis le plus longtemps. Pas de SM-2, juste ces deux critères.
 */
export function reviewOrder(a: VocabularyEntry, b: VocabularyEntry): number {
  const rateDelta = failureRate(b) - failureRate(a);
  if (Math.abs(rateDelta) > 0.0001) return rateDelta;

  // Jamais revu passe avant tout ce qui l'a déjà été.
  const lastA = a.lastReviewedAt ?? 0;
  const lastB = b.lastReviewedAt ?? 0;
  if (lastA !== lastB) return lastA - lastB;

  return a.createdAt - b.createdAt;
}
