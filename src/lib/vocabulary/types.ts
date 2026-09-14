export interface VocabularyEntry {
  id: number;
  term: string;
  /** La réplique complète : sans elle, le mot ne veut plus rien dire. */
  cueText: string;
  titleKey: string;
  titleName: string;
  episodeLabel: string | null;
  startMs: number;
  translation: string | null;
  explanation: string | null;
  register: string | null;
  kind: string | null;
  createdAt: number;
  reviews: number;
  failures: number;
  lastReviewedAt: number | null;
}

export type NewVocabularyEntry = Omit<
  VocabularyEntry,
  'id' | 'createdAt' | 'reviews' | 'failures' | 'lastReviewedAt'
>;
