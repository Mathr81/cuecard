'use client';

import { useCallback, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { ContextualSenseBlock, type SenseContext } from '@/components/ContextualSenseBlock';
import { DictionaryBlock } from '@/components/DictionaryBlock';
import { WordEntryBlock } from '@/components/WordEntryBlock';
import { ExternalLinksBlock } from '@/components/ExternalLinksBlock';
import { SaveToNotebook, type SaveTarget } from '@/components/SaveToNotebook';
import type { ContextualSense } from '@/lib/sense/schema';

export interface Lookup {
  /** Le mot ou l'expression sélectionnée, ponctuation retirée. */
  term: string;
  /** La réplique d'où il vient, affichée en sous-titre de la feuille. */
  context: string;
  /** La scène et le titre, pour l'explication en contexte. */
  scene: SenseContext;
  /** De quoi ranger le mot dans le carnet. */
  target: SaveTarget;
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

  // Le sens remonte du bloc LLM pour être sauvegardé avec le mot ; il est
  // remis à zéro dès qu'on change de mot, via la clé du panneau.
  const [sense, setSense] = useState<ContextualSense | null>(null);
  const rememberSense = useCallback((value: ContextualSense) => setSense(value), []);

  return (
    <BottomSheet
      open={lookup !== null}
      title={term}
      subtitle={lookup?.context}
      action={lookup ? <SaveToNotebook key={term} target={lookup.target} sense={sense} /> : null}
      onClose={onClose}
    >
      {lookup ? (
        <PanelBody key={term} lookup={lookup} isExpression={isExpression} onSense={rememberSense} />
      ) : null}
    </BottomSheet>
  );
}

function PanelBody({
  lookup,
  isExpression,
  onSense,
}: {
  lookup: Lookup;
  isExpression: boolean;
  onSense: (sense: ContextualSense) => void;
}) {
  return (
    <div className="mt-2 flex flex-col">
      <ContextualSenseBlock term={lookup.term} context={lookup.scene} onSense={onSense} />
      <WordEntryBlock term={lookup.term} />
      <DictionaryBlock term={lookup.term} isExpression={isExpression} />
      <ExternalLinksBlock term={lookup.term} />
    </div>
  );
}
