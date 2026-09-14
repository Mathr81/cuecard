import type { TitleRef } from '@/lib/titles/types';

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
  /** `${titleKey}#${fileId}` : identifie le couple titre / source. */
  id: string;
  /** Clé du titre, pour l'historique et le décalage mémorisé. */
  titleKey: string;
  /** Identifiant de la source : file_id OpenSubtitles, ou "upload". */
  fileId: string;
  name: string;
  /** Deuxième ligne : "S01E04 · Titre de l'épisode", ou le nom de la release. */
  subtitle: string | null;
  source: 'upload' | 'opensubtitles';
  releaseName: string | null;
  encoding: string;
  format: 'srt' | 'vtt';
  cues: Cue[];
  loadedAt: number;
  title: TitleRef | null;
}
