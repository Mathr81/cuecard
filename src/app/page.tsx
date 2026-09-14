import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CaretRight, GearSix, ICON, iconProps } from '@/components/icons';
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
      <header className="pt-safe flex items-center gap-2 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{tApp('name')}</h1>
          <p className="mt-0.5 text-[0.8125rem] text-dim">{tApp('tagline')}</p>
        </div>
        <Link
          href="/vocabulaire"
          className="press flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-muted"
        >
          {tVocabulary('open')}
        </Link>
        <Link
          href="/settings"
          aria-label={tSettings('title')}
          className="press -mr-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted"
        >
          <GearSix size={ICON} {...iconProps} />
        </Link>
      </header>

      <main className="pb-safe flex flex-1 flex-col gap-8 py-2">
        <TitleSearch />

        <section className="flex flex-col gap-3">
          <h2 className="text-[0.8125rem] text-dim">{t('recent')}</h2>
          <RecentDocument />
          <RecentTitles />
        </section>

        {/* Le chargement manuel est le recours, pas le chemin : replié par
            défaut, sans cadre, il attend sans rien demander. */}
        <details open={upload === '1'} className="group border-t border-line pt-2">
          <summary className="press flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl text-sm text-muted">
            <CaretRight
              size={14}
              {...iconProps}
              className="shrink-0 text-dim transition-transform group-open:rotate-90"
            />
            {tTitles('uploadSection')}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-dim">{tTitles('uploadHint')}</p>
            <SubtitleDropzone />
          </div>
        </details>
      </main>
    </div>
  );
}
