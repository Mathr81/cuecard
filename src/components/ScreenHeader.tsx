import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, ICON, iconProps } from '@/components/icons';

/**
 * L'en-tête des écrans secondaires : un retour, un titre, parfois une action.
 *
 * Aucun des trois n'est encadré. Sur un téléphone tenu d'une main, la flèche
 * est une cible de 44px qu'on vise sans regarder ; lui dessiner une boîte ne
 * l'agrandit pas, ça ajoute juste une ligne de plus à l'écran.
 */
export async function ScreenHeader({
  title,
  subtitle,
  backHref,
  before,
  action,
}: {
  title: string;
  subtitle?: string | null;
  backHref: string;
  /** Une vignette posée entre la flèche et le titre. */
  before?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const t = await getTranslations('common');

  return (
    <header className="pt-safe flex items-center gap-2 py-4">
      <Link
        href={backHref}
        aria-label={t('back')}
        className="press -ml-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted"
      >
        <ArrowLeft size={ICON} {...iconProps} />
      </Link>
      {before}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 truncate text-sm text-dim">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
