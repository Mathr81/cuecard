/** Les sources interrogées, dans l'ordre où elles sont essayées par défaut. */
export type DictionarySourceId = 'freedictionary' | 'dictionaryapi' | 'datamuse';

export interface DictionarySource {
  id: DictionarySourceId;
  /** La page d'origine de l'entrée, quand la source la donne. */
  url: string | null;
  /** Le nom de la licence, à afficher : Wiktionary est en CC BY-SA. */
  license: string | null;
}

export interface DictionaryDefinition {
  text: string;
  example: string | null;
  synonyms: string[];
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
  synonyms: string[];
}

export interface DictionaryEntry {
  /** Le mot demandé, tel que tapé dans la réplique. */
  requested: string;
  /** La forme réellement trouvée : "run" quand on a tapé sur "running". */
  word: string;
  phonetic: string | null;
  audio: { url: string; accent: string | null } | null;
  meanings: DictionaryMeaning[];
  source: DictionarySource;
}

export type DictionaryErrorCode = 'not_found' | 'upstream' | 'invalid_response' | 'network';

export interface DictionaryErrorBody {
  error: DictionaryErrorCode;
  word: string;
}
