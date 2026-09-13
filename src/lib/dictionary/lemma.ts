/**
 * dictionaryapi.dev n'indexe que les formes de base : taper sur "running" ou
 * "wolves" ne renvoie rien. Plutôt que d'embarquer un lemmatiseur complet, on
 * essaie quelques formes candidates, de la plus probable à la plus bricolée.
 */

const IRREGULAR_PLURALS: Record<string, string> = {
  children: 'child',
  men: 'man',
  women: 'woman',
  people: 'person',
  teeth: 'tooth',
  feet: 'foot',
  geese: 'goose',
  mice: 'mouse',
  lives: 'life',
  knives: 'knife',
  wives: 'wife',
  leaves: 'leaf',
  wolves: 'wolf',
  halves: 'half',
  selves: 'self',
};

const DOUBLED_CONSONANT = /([^aeiou])\1$/;

function withoutDoubledConsonant(stem: string): string | null {
  return DOUBLED_CONSONANT.test(stem) ? stem.slice(0, -1) : null;
}

/** Formes à essayer, sans doublon, dans l'ordre où elles ont le plus de chances. */
export function candidateForms(rawWord: string): string[] {
  const word = rawWord.toLowerCase().trim();
  const candidates: string[] = [word];

  const push = (value: string | null | undefined) => {
    if (value && value.length >= 2 && !candidates.includes(value)) candidates.push(value);
  };

  // Possessif : "Frank's" -> "Frank"
  push(word.replace(/['’]s$/, ''));
  // Contraction : "don't" reste tel quel, mais "'em" -> "em" est déjà géré.

  push(IRREGULAR_PLURALS[word]);

  if (word.endsWith('ies') && word.length > 4) push(`${word.slice(0, -3)}y`);
  if (word.endsWith('es') && word.length > 3) {
    push(word.slice(0, -2));
    push(word.slice(0, -1));
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) push(word.slice(0, -1));

  if (word.endsWith('ing') && word.length > 5) {
    const stem = word.slice(0, -3);
    push(stem);
    push(`${stem}e`);
    push(withoutDoubledConsonant(stem));
  }

  if (word.endsWith('ed') && word.length > 4) {
    const stem = word.slice(0, -2);
    push(stem);
    push(`${stem}e`);
    push(withoutDoubledConsonant(stem));
    if (stem.endsWith('i')) push(`${stem.slice(0, -1)}y`);
  }

  if (word.endsWith('er') && word.length > 4) push(word.slice(0, -2));
  if (word.endsWith('est') && word.length > 5) push(word.slice(0, -3));
  if (word.endsWith('ly') && word.length > 4) push(word.slice(0, -2));

  // Quatre appels réseau au maximum : au-delà, l'attente coûte plus que le gain.
  return candidates.slice(0, 4);
}
