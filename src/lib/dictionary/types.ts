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
  sourceUrls: string[];
}

export type DictionaryErrorCode = 'not_found' | 'upstream' | 'invalid_response' | 'network';

export interface DictionaryErrorBody {
  error: DictionaryErrorCode;
  word: string;
}
