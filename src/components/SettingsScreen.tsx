'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { LocaleChoice } from '@/components/LocaleChoice';
import { setContentLocale, setUiLocale } from '@/i18n/actions';
import type { Locale } from '@/i18n/config';
import { useTokenStore } from '@/store/tokens';

export function SettingsScreen({
  uiLocale,
  senseLocale,
  model,
  hasOpenRouterKey,
}: {
  uiLocale: Locale;
  senseLocale: Locale;
  model: string;
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
      <TokenCounter model={model} hasOpenRouterKey={hasOpenRouterKey} />
    </div>
  );
}

function TokenCounter({ model, hasOpenRouterKey }: { model: string; hasOpenRouterKey: boolean }) {
  const t = useTranslations('settings');
  const format = useFormatter();

  const totalTokens = useTokenStore((state) => state.totalTokens);
  const promptTokens = useTokenStore((state) => state.promptTokens);
  const completionTokens = useTokenStore((state) => state.completionTokens);
  const calls = useTokenStore((state) => state.calls);
  const cachedCalls = useTokenStore((state) => state.cachedCalls);
  const since = useTokenStore((state) => state.since);
  const reset = useTokenStore((state) => state.reset);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">{t('tokens')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{t('tokensHelp')}</p>

      <p className="mt-3 font-mono text-3xl text-accent">{format.number(totalTokens)}</p>
      <p className="text-xs text-dim">
        {t('tokensBreakdown', { prompt: promptTokens, completion: completionTokens })}
      </p>

      <dl className="mt-3 flex flex-col gap-1 text-sm">
        <Row label={t('tokensCalls')} value={format.number(calls)} />
        {/* Les appels servis par le cache sont gratuits : les compter à part
            montre ce que le cache fait vraiment gagner. */}
        <Row label={t('tokensCached')} value={format.number(cachedCalls)} />
        <Row
          label={t('tokensSince')}
          value={format.dateTime(since, { dateStyle: 'short', timeStyle: 'short' })}
        />
        <Row label={t('model')} value={model} />
      </dl>

      {!hasOpenRouterKey ? (
        <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {t('missingOpenRouterKey')}
        </p>
      ) : null}

      <button
        type="button"
        onClick={reset}
        className="mt-4 min-h-12 w-full rounded-xl border border-line bg-surface-high text-sm font-semibold text-ink"
      >
        {t('tokensReset')}
      </button>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-mono text-xs text-ink">{value}</dd>
    </div>
  );
}
