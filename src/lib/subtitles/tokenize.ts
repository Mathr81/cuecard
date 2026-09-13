export interface Token {
  kind: 'word' | 'separator';
  /** Le texte tel qu'il apparaît dans la réplique. */
  text: string;
  /** Position dans la ligne, pour retrouver le contexte exact plus tard. */
  start: number;
  end: number;
}

/**
 * Un mot anglais garde ses apostrophes internes et finales ("don't", "y'all",
 * "goin'") et ses traits d'union ("mother-in-law") : découper dessus
 * transformerait un mot cherchable en deux fragments inutiles.
 */
const WORD = /[\p{L}\p{N}]+(?:[’'’-][\p{L}\p{N}]+)*[’']?/gu;

export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of line.matchAll(WORD)) {
    const start = match.index;
    if (start > cursor) {
      tokens.push({
        kind: 'separator',
        text: line.slice(cursor, start),
        start: cursor,
        end: start,
      });
    }
    tokens.push({ kind: 'word', text: match[0], start, end: start + match[0].length });
    cursor = start + match[0].length;
  }

  if (cursor < line.length) {
    tokens.push({ kind: 'separator', text: line.slice(cursor), start: cursor, end: line.length });
  }

  return tokens;
}

export interface WordChip {
  /** Le mot seul, sans ponctuation : la clé du dictionnaire. */
  word: string;
  /** Ce qui est affiché : le mot avec la ponctuation qui le suit ("world!"). */
  display: string;
  /** Ce qui sépare cette puce de la précédente : espaces, tiret de dialogue. */
  before: string;
  start: number;
  end: number;
}

/**
 * Regroupe chaque mot avec la ponctuation qui le colle, pour obtenir des
 * cibles tactiles larges et espacées sans perdre la ponctuation à l'écran.
 */
export function toWordChips(line: string): WordChip[] {
  const tokens = tokenizeLine(line);
  const chips: WordChip[] = [];
  let pendingBefore = '';

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.kind === 'separator') {
      pendingBefore += token.text;
      continue;
    }

    const next = tokens[i + 1];
    // La ponctuation collée au mot le suit ; l'espace suivant marque la coupure.
    let trailing = '';
    if (next && next.kind === 'separator') {
      trailing = /^\S+/.exec(next.text)?.[0] ?? '';
      next.text = next.text.slice(trailing.length);
    }

    // La ponctuation ouvrante collée au mot le précède dans la même puce :
    // afficher « "Wait," » d'un bloc se lit mieux que « " » puis « Wait, ».
    const attachedBefore = /\S+$/.exec(pendingBefore)?.[0] ?? '';
    const detachedBefore = pendingBefore.slice(0, pendingBefore.length - attachedBefore.length);

    chips.push({
      word: stripEdgeApostrophes(token.text),
      display: attachedBefore + token.text + trailing,
      before: detachedBefore,
      start: token.start - attachedBefore.length,
      end: token.end + trailing.length,
    });
    pendingBefore = '';
  }

  return chips;
}

function stripEdgeApostrophes(word: string): string {
  return word.replace(/^[’']+/, '').replace(/[’']+$/, '') || word;
}

/** Clé de recherche d'un mot : minuscules, apostrophes normalisées. */
export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[’ʼ]/g, "'").trim();
}
