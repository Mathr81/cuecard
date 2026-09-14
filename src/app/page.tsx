import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { RecentDocument } from '@/components/RecentDocument';
import { RecentTitles } from '@/components/RecentTitles';
import { SubtitleDropzone } from '@/components/SubtitleDropzone';
import { TitleSearch } from '@/components/TitleSearch';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ upload?: string }>;
}) {
  const { upload } = await searchParams;
  const t = await getTranslations('home');
  const tApp = await getTranslations('app');
  const tTitles = await getTranslations('titles');
  const tSettings = await getTranslations('settings');
  const tVocabulary = await getTranslations('vocabulary');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4">
      <header className="pt-safe flex items-center justify-between gap-3 py-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-ink">{tApp('name')}</h1>
          <p className="text-xs text-dim">{tApp('tagline')}</p>
        </div>
        <Link
          href="/vocabulaire"
          className="flex min-h-11 items-center rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-muted"
        >
          {tVocabulary('open')}
        </Link>
        <Link
          href="/settings"
          aria-label={tSettings('title')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-lg text-muted"
        >
          ☰
        </Link>
      </header>

      <main className="pb-safe flex flex-1 flex-col gap-6 py-2">
        <TitleSearch />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">{t('recent')}</h2>
          <RecentDocument />
          <RecentTitles />
        </section>

        <details open={upload === '1'} className="rounded-2xl border border-line bg-surface/50 p-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-muted">
            {tTitles('uploadSection')}
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm leading-relaxed text-dim">{tTitles('uploadHint')}</p>
            <SubtitleDropzone />
          </div>
        </details>
      </main>
    </div>
  );
}
