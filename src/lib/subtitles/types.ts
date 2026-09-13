/** Une réplique de sous-titre, nettoyée et prête à être affichée. */
export interface Cue {
  /** Position dans le fichier, réindexée à partir de 0 après fusion. */
  index: number;
  startMs: number;
  endMs: number;
  /** Texte nettoyé, les retours à la ligne d'origine sont conservés. */
  text: string;
}

export interface SubtitleDocument {
  id: string;
  /** Nom affiché : nom du fichier uploadé, ou titre TMDB plus tard. */
  name: string;
  source: 'upload';
  /** Encodage détecté à la lecture du fichier, affiché en cas de doute. */
  encoding: string;
  format: 'srt' | 'vtt';
  cues: Cue[];
  loadedAt: number;
}
