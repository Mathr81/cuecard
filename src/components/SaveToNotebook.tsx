'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookmarkSimple, ICON } from '@/components/icons';
import { apiGet, apiSend } from '@/lib/api/client';
import type { ContextualSense } from '@/lib/sense/schema';
import type { VocabularyEntry } from '@/lib/vocabulary/types';

export interface SaveTarget {
  term: string;
  cueText: string;
  titleKey: string;
  titleName: string;
  episodeLabel: string | null;
  startMs: number;
}

function payload(target: SaveTarget, sense: ContextualSense | null) {
  return {
    ...target,
    translation: sense?.traduction_contextuelle ?? null,
    explanation: sense?.explication ?? null,
    register: sense?.registre ?? null,
    kind: sense?.type ?? null,
  };
}

/** `undefined` : on ne sait pas encore. `null` : pas dans le carnet. */
type Known = VocabularyEntry | null | undefined;

/**
 * Le marque-page de la feuille, posé dans l'en-tête à côté de la croix.
 *
 * Il y était un bouton pleine largeur, entre le mot et sa traduction : l'action
 * passait avant la réponse et poussait celle-ci sous la ligne de flottaison.
 * En icône, il reste à portée de pouce, toujours au même endroit, et rempli
 * d'ambre quand le mot est au carnet. Le libellé n'a pas disparu, il est dans
 * l'`aria-label` : « Sauvegarder », puis « Retirer du carnet ».
 */
export function SaveToNotebook({
  target,
  sense,
}: {
  target: SaveTarget;
  sense: ContextualSense | null;
}) {
  const t = useTranslations('vocabulary');
  const [entry, setEntry] = useState<Known>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      term: target.term,
      titleKey: target.titleKey,
      startMs: String(target.startMs),
    });

    apiGet<{ entry: VocabularyEntry | null }>(`/api/vocabulary/lookup?${query}`, controller.signal)
      .then((data) => setEntry(data.entry))
      .catch(() => {
        if (!controller.signal.aborted) setEntry(null);
      });

    return () => controller.abort();
  }, [target]);

  useEffect(() => {
    // J'ai sauvegardé avant que l'explication n'arrive : on complète l'entrée
    // au lieu de la laisser vide, sans rien demander de plus.
    if (!sense || !entry || entry.translation) return;

    const controller = new AbortController();
    apiSend<{ entry: VocabularyEntry }>(
      '/api/vocabulary',
      'POST',
      payload(target, sense),
      controller.signal
    )
      .then((data) => setEntry(data.entry))
      .catch(() => undefined);

    return () => controller.abort();
  }, [sense, entry, target]);

  async function save() {
    setBusy(true);
    try {
      const data = await apiSend<{ entry: VocabularyEntry }>(
        '/api/vocabulary',
        'POST',
        payload(target, sense)
      );
      setEntry(data.entry);
    } catch {
      setEntry(null);
    } finally {
      setBusy(false);
    }
  }

  async function forget(id: number) {
    setBusy(true);
    setEntry(null);
    await apiSend(`/api/vocabulary?id=${id}`, 'DELETE').catch(() => undefined);
    setBusy(false);
  }

  // Tant que la réponse du carnet n'est pas là, la place est tenue mais rien
  // ne clignote : un marque-page qui se remplit tout seul ferait croire à un
  // enregistrement qu'on n'a pas demandé.
  if (entry === undefined) {
    return <div className="size-11 shrink-0" aria-hidden />;
  }

  const saved = entry !== null;

  return (
    <button
      type="button"
      onClick={() => void (saved ? forget(entry.id) : save())}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? t('remove') : t('save')}
      className={`press flex size-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-50 ${
        saved ? 'text-accent' : 'text-muted'
      }`}
    >
      <BookmarkSimple size={ICON} weight={saved ? 'fill' : 'bold'} aria-hidden />
    </button>
  );
}
