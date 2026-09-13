'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setUiLocale } from '@/i18n/actions';
import { locales, type Locale } from '@/i18n/config';

export function LocaleSwitch() {
  const t = useTranslations('settings');
  const active = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const labels: Record<Locale, string> = { fr: 'FR', en: 'EN' };

  return (
    <div
      className="flex items-center gap-1 rounded-full border border-line bg-surface p-1"
      role="group"
      aria-label={t('uiLanguage')}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={active === locale}
          disabled={pending}
          onClick={() => {
            if (active === locale) return;
            startTransition(async () => {
              await setUiLocale(locale);
              router.refresh();
            });
          }}
          className={`min-h-9 min-w-11 rounded-full px-3 text-sm font-semibold transition-colors ${
            active === locale ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'
          }`}
        >
          {labels[locale]}
        </button>
      ))}
    </div>
  );
}
