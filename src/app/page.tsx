import { getTranslations } from 'next-intl/server';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { RecentDocument } from '@/components/RecentDocument';
import { SubtitleDropzone } from '@/components/SubtitleDropzone';

export default async function HomePage() {
  const t = await getTranslations('home');
  const tApp = await getTranslations('app');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4">
      <header className="pt-safe flex items-center justify-between gap-3 py-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-ink">{tApp('name')}</h1>
          <p className="text-xs text-dim">{tApp('tagline')}</p>
        </div>
        <LocaleSwitch />
      </header>

      <main className="flex flex-1 flex-col gap-6 py-4">
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-sm leading-relaxed text-muted">{t('subtitle')}</p>
          <SubtitleDropzone />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">{t('recent')}</h2>
          <RecentDocument />
        </section>
      </main>
    </div>
  );
}
