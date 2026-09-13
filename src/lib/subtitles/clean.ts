const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  return String.fromCodePoint(code);
}

/**
 * Retire tout ce qui sert au rendu et jamais à la lecture : balises HTML des
 * .srt (<i>, <b>, <font>), overrides ASS/SSA ({\an8}, {\pos(192,220)}),
 * marqueurs VTT (<v Alice>, <c.yellow>, <00:00:03.000>).
 */
export function cleanCueText(input: string): string {
  const withoutMarkup = decodeEntities(
    input
      // Overrides ASS/SSA, avec ou sans antislash : {\an8}, {\pos(..)}, {an8}
      .replace(/\{\s*\\[^}]*\}/g, '')
      .replace(/\{\s*an\d\s*\}/gi, '')
      // Horodatages inline des VTT karaoké
      .replace(/<\d{1,3}:\d{2}:\d{2}[.,]\d{1,3}>/g, '')
      .replace(/<\d{1,2}:\d{2}[.,]\d{1,3}>/g, '')
      // Balises restantes : <i>, </i>, <font color="#fff">, <v Alice>, <c.yellow>
      .replace(/<\/?[a-z][^>]*>/gi, '')
  );

  return withoutMarkup
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
