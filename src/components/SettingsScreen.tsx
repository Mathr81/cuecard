'use client';

import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { apiSend } from '@/lib/api/client';
import type { UsageTotals } from '@/lib/usage/repository';
import { LocaleChoice } from '@/components/LocaleChoice';
import { setContentLocale, setUiLocale } from '@/i18n/actions';
import { estimateCostUsd, type ModelPricing } from '@/lib/openrouter/cost';
import type { Locale } from '@/i18n/config';

export function SettingsScreen({
  uiLocale,
  senseLocale,
  model,
  pricing,
  usage,
  hasOpenRouterKey,
}: {
  uiLocale: Locale;
  senseLocale: Locale;
  model: string;
  /** `null` quand OpenRouter ne connaît pas ce modèle : il a sans doute été retiré. */
  pricing: ModelPricing | null;
  /** Totaux lus en base : la consommation est celle du serveur, donc la même
   *  depuis n'importe quel appareil. */
  usage: UsageTotals;
  hasOpenRouterKey: boolean;
}) {
  const t = useTranslations('settings');

  return (
    <div className="flex flex-col gap-4">
      <LocaleChoice
        label={t('uiLanguage')}
        description={t('uiLanguageHelp')}
        active={uiLocale}
        onChange={setUiLocale}
      />
      <LocaleChoice
        label={t('contentLanguage')}
        description={t('contentLanguageHelp')}
        active={senseLocale}
        onChange={setContentLocale}
      />
      <TokenCounter
        model={model}
        pricing={pricing}
        usage={usage}
        hasOpenRouterKey={hasOpenRouterKey}
      />
    </div>
  );
}

function TokenCounter({
  model,
  pricing,
  usage,
  hasOpenRouterKey,
}: {
  model: string;
  pricing: ModelPricing | null;
  usage: UsageTotals;
  hasOpenRouterKey: boolean;
}) {
  const t = useTranslations('settings');
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">{t('tokens')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{t('tokensHelp')}</p>

      <p className="mt-3 font-mono text-3xl text-accent">
        {pricing ? formatUsd(estimateCostUsd(usage, pricing)) : format.number(usage.totalTokens)}
      </p>
      <p className="text-xs text-dim">
        {pricing ? `${format.number(usage.totalTokens)} ${t('tokensUnit')} · ` : ''}
        {t('tokensBreakdown', {
          prompt: usage.promptTokens,
          completion: usage.completionTokens,
        })}
      </p>

      <dl className="mt-3 flex flex-col gap-1 text-sm">
        <Row label={t('tokensCalls')} value={format.number(usage.calls)} />
        {/* Les appels servis par le cache sont gratuits : les compter à part
            montre ce que le cache fait vraiment gagner. */}
        <Row label={t('tokensCached')} value={format.number(usage.cachedCalls)} />
        <Row
          label={t('tokensSince')}
          value={
            usage.since === null
              ? '—'
              : format.dateTime(usage.since, { dateStyle: 'short', timeStyle: 'short' })
          }
        />
        <Row label={t('model')} value={pricing?.displayName ?? model} />
        {pricing ? (
          <Row
            label={t('rate')}
            value={t('ratePerMillion', {
              prompt: formatUsd(pricing.promptUsdPerToken * 1_000_000),
              completion: formatUsd(pricing.completionUsdPerToken * 1_000_000),
            })}
          />
        ) : null}
      </dl>

      {/* OpenRouter retire les modèles obsolètes de sa liste : un identifiant
          introuvable annonce des appels qui vont échouer. */}
      {!pricing ? (
        <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {t('unknownModel', { model })}
        </p>
      ) : null}

      {!hasOpenRouterKey ? (
        <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {t('missingOpenRouterKey')}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await apiSend('/api/usage', 'DELETE').catch(() => undefined);
            router.refresh();
          })
        }
        className="mt-4 min-h-12 w-full rounded-xl border border-line bg-surface-high text-sm font-semibold text-ink disabled:opacity-50"
      >
        {t('tokensReset')}
      </button>
    </section>
  );
}

/** Les montants sont minuscules : quatre décimales, sinon tout vaut « $0.00 ». */
function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-mono text-xs text-ink">{value}</dd>
    </div>
  );
}
