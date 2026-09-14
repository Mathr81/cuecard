/**
 * Les pièces communes de la feuille de définition.
 *
 * Elles existent pour que la hiérarchie du panneau soit décidée à un seul
 * endroit. Quatre blocs empilés avec chacun son étiquette en petites capitales,
 * c'est le gabarit qu'on reconnaît de loin : ici, deux blocs seulement portent
 * une étiquette, et elle se lit comme du texte, pas comme un tampon.
 *
 * L'ambre ne marque qu'une chose dans tout le panneau : le sens dans cette
 * réplique-là, celui qu'on est venu chercher. Le reste est gris.
 */

export function PanelSection({
  label,
  ariaLabel,
  children,
}: {
  /** Absente quand le contenu se présente tout seul : un titre de plus ne
   *  dirait rien que le texte en dessous ne dise déjà. */
  label?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7 first:mt-0" aria-label={label ? undefined : ariaLabel}>
      {label ? <h3 className="mb-3 text-[0.8125rem] text-dim">{label}</h3> : null}
      {children}
    </section>
  );
}

/** La nature et le registre, posés sous le sens : une ligne de texte, pas une
 *  rangée de pastilles. */
export function Meta({ parts }: { parts: (string | null | undefined)[] }) {
  const kept = parts.filter((part): part is string => Boolean(part));
  if (kept.length === 0) return null;

  return <p className="mt-1 text-[0.8125rem] text-dim">{kept.join(' · ')}</p>;
}

/** Un exemple, anglais puis français quand il y a les deux. Le filet vertical
 *  suffit à le détacher du raisonnement : pas de cadre. */
export function Example({ en, fr }: { en: string; fr?: string | null }) {
  return (
    <div className="border-l border-line pl-3">
      <p className="text-sm leading-relaxed text-ink">{en}</p>
      {fr ? <p className="mt-0.5 text-sm leading-relaxed text-muted">{fr}</p> : null}
    </div>
  );
}

/** Ce qui mérite d'être encadré : une mise en garde, une note culturelle. Elles
 *  sont rares, donc le fond plein reste un signal. */
export function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl bg-surface-high px-4 py-3">
      <p className="text-[0.8125rem] text-dim">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export function RetryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press mt-4 min-h-11 rounded-xl bg-surface-high px-4 text-sm font-semibold text-ink"
    >
      {label}
    </button>
  );
}

/** Un squelette à la forme du contenu attendu, pas un rond qui tourne. */
export function Skeleton({ label, widths }: { label: string; widths: string[] }) {
  return (
    <div className="flex flex-col gap-2.5" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {widths.map((width, index) => (
        <div
          key={index}
          className={`h-4 animate-pulse rounded bg-surface-high ${width}`}
          style={{ animationDelay: `${index * 90}ms` }}
        />
      ))}
    </div>
  );
}

/** Déplier la suite d'une liste : la même commande dans les trois blocs. */
export function MoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press mt-4 min-h-11 text-sm font-semibold text-muted"
    >
      {label}
    </button>
  );
}
