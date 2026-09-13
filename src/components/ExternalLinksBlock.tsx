import { useTranslations } from 'next-intl';
import { externalLinks } from '@/lib/dictionary/links';

export function ExternalLinksBlock({ term }: { term: string }) {
  const t = useTranslations('definition');

  return (
    <section className="mt-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-dim">
        {t('externalLinks')}
      </h3>
      <ul className="flex flex-col gap-2">
        {externalLinks(term).map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line bg-surface-high px-4"
            >
              <span className="text-base font-medium text-ink">{link.label}</span>
              <span className="text-sm text-dim">{link.description} ↗</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
