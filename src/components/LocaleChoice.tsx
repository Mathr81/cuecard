'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { locales, type Locale } from '@/i18n/config';

/** Un réglage de langue : celui de l'interface ou celui des explications. */
export function LocaleChoice({
  label,
  description,
  active,
  onChange,
}: {
  label: string;
  description: string;
  active: Locale;
  onChange: (locale: Locale) => Promise<void>;
}) {
  const t = useTranslations('settings');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const names: Record<Locale, string> = { fr: t('french'), en: t('english') };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">{label}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>

      <div className="mt-3 flex gap-2" role="group" aria-label={label}>
        {locales.map((locale) => (
          <button
            key={locale}
            type="button"
            aria-pressed={active === locale}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await onChange(locale);
                router.refresh();
              })
            }
            className={`min-h-12 flex-1 rounded-xl border text-sm font-semibold transition-colors ${
              active === locale
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line bg-surface-high text-muted'
            }`}
          >
            {names[locale]}
          </button>
        ))}
      </div>
    </section>
  );
}
