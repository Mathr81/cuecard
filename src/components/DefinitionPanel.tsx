'use client';

import { BottomSheet } from '@/components/BottomSheet';
import { ContextualSenseBlock, type SenseContext } from '@/components/ContextualSenseBlock';
import { DictionaryBlock } from '@/components/DictionaryBlock';
import { ExternalLinksBlock } from '@/components/ExternalLinksBlock';

export interface Lookup {
  /** Le mot ou l'expression sélectionnée, ponctuation retirée. */
  term: string;
  /** La réplique d'où il vient, affichée en sous-titre de la feuille. */
  context: string;
  /** La scène et le titre, pour l'explication en contexte. */
  scene: SenseContext;
}

/**
 * Les blocs sont indépendants et chargés en parallèle : le dictionnaire ne doit
 * jamais attendre le LLM, ni les liens attendre quoi que ce soit.
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
          <DictionaryBlock key={`dict-${term}`} term={term} isExpression={isExpression} />
          <ContextualSenseBlock key={`sense-${term}`} term={term} context={lookup.scene} />
          <ExternalLinksBlock term={term} />
        </>
      ) : null}
    </BottomSheet>
  );
}
