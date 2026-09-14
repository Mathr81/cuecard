import { useTranslations } from 'next-intl';
import { ArrowUpRight, iconProps } from '@/components/icons';
import { externalLinks } from '@/lib/dictionary/links';

/**
 * Le bas de la feuille : ce qu'on va consulter ailleurs quand les trois blocs
 * au-dessus n'ont pas suffi. Pas de titre, pas de filet non plus, la note de
 * source du dictionnaire en trace déjà un juste au-dessus : l'écart suffit à
 * dire que la lecture est finie et que la suite se passe dehors.
 */
export function ExternalLinksBlock({ term }: { term: string }) {
  const t = useTranslations('definition');

  return (
    <section className="mt-8" aria-label={t('externalLinks')}>
      <ul className="flex flex-col gap-2">
        {externalLinks(term).map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="press flex min-h-14 items-center gap-3 rounded-xl bg-surface-high px-4"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-ink">{link.label}</span>
                <span className="block truncate text-[0.8125rem] text-dim">{link.description}</span>
              </span>
              <ArrowUpRight size={16} {...iconProps} className="shrink-0 text-dim" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
