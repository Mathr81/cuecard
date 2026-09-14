/**
 * Les fichiers d'OpenSubtitles s'ouvrent et se referment souvent sur une
 * réclame — « Support us and become VIP member », « Advertise your product or
 * brand here ». Ce n'est pas du dialogue : la garder mettrait une publicité en
 * première réplique du lecteur et la ferait remonter dans les recherches.
 *
 * La liste vise des noms de sites et des formules figées, jamais des tournures
 * qu'un film pourrait employer : on préfère laisser passer une pub qu'effacer
 * une vraie ligne.
 */
const PROMO_PATTERNS: readonly RegExp[] = [
  /opensubtitles/i,
  /osdb\.link/i,
  /allsubs\b/i,
  /subscene/i,
  /addic7ed/i,
  /yifysubtitles|yify\s+subtitles/i,
  /podnapisi/i,
  /\bsubdl\b/i,
  /support us and become/i,
  /become (?:a )?vip member/i,
  /advertise your product or brand/i,
  /please rate this subtitle/i,
  /watch (?:any|all) video online with/i,
];

export function isPromoCue(text: string): boolean {
  return PROMO_PATTERNS.some((pattern) => pattern.test(text));
}
