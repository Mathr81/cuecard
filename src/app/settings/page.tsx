import { getLocale, getTranslations } from 'next-intl/server';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsScreen } from '@/components/SettingsScreen';
import { contentLocale } from '@/i18n/content';
import { isLocale } from '@/i18n/config';
import { senseModel } from '@/lib/openrouter/client';
import { modelPricing } from '@/lib/openrouter/pricing';
import { usageTotals } from '@/lib/usage/repository';

export default async function SettingsPage() {
  const t = await getTranslations('settings');
  const uiLocale = await getLocale();
  const model = senseModel();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4">
      <ScreenHeader title={t('title')} backHref="/" />

      <main className="pb-safe flex-1 py-2">
        <SettingsScreen
          uiLocale={isLocale(uiLocale) ? uiLocale : 'fr'}
          senseLocale={await contentLocale()}
          model={model}
          pricing={await modelPricing(model)}
          usage={usageTotals()}
          hasOpenRouterKey={Boolean(process.env.OPENROUTER_API_KEY?.trim())}
        />
      </main>
    </div>
  );
}
