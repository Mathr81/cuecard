import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { SettingsScreen } from '@/components/SettingsScreen';
import { contentLocale } from '@/i18n/content';
import { isLocale } from '@/i18n/config';
import { senseModel } from '@/lib/openrouter/client';
import { modelPricing } from '@/lib/openrouter/pricing';

export default async function SettingsPage() {
  const t = await getTranslations('settings');
  const tCommon = await getTranslations('common');
  const uiLocale = await getLocale();
  const model = senseModel();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4">
      <header className="pt-safe flex items-center gap-2 py-3">
        <Link
          href="/"
          aria-label={tCommon('back')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-muted"
        >
          ←
        </Link>
        <h1 className="text-lg font-bold tracking-tight text-ink">{t('title')}</h1>
      </header>

      <main className="pb-safe flex-1 py-2">
        <SettingsScreen
          uiLocale={isLocale(uiLocale) ? uiLocale : 'fr'}
          senseLocale={await contentLocale()}
          model={model}
          pricing={await modelPricing(model)}
          hasOpenRouterKey={Boolean(process.env.OPENROUTER_API_KEY?.trim())}
        />
      </main>
    </div>
  );
}
