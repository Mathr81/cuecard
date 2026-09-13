'use client';

import { BottomSheet } from '@/components/BottomSheet';
import { DictionaryBlock } from '@/components/DictionaryBlock';
import { ExternalLinksBlock } from '@/components/ExternalLinksBlock';

export interface Lookup {
  /** Le mot ou l'expression sélectionnée, ponctuation retirée. */
  term: string;
  /** La réplique d'où il vient, affichée en sous-titre de la feuille. */
  context: string;
}

/**
 * Les blocs sont indépendants et chargés en parallèle : le dictionnaire ne doit
 * jamais attendre les liens, ni plus tard le LLM.
 */
export function DefinitionPanel({
  lookup,
  onClose,
}: {
  lookup: Lookup | null;
  onClose: () => void;
}) {
  const term = lookup?.term ?? '';
  const isExpression = term.includes(' ');

  return (
    <BottomSheet open={lookup !== null} title={term} subtitle={lookup?.context} onClose={onClose}>
      {lookup ? (
        <>
          <DictionaryBlock key={term} term={term} isExpression={isExpression} />
          <ExternalLinksBlock term={term} />
        </>
      ) : null}
    </BottomSheet>
  );
}
