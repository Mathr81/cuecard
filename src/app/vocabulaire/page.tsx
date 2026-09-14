import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { VocabularyList } from '@/components/VocabularyList';

export default async function VocabularyPage() {
  const t = await getTranslations('vocabulary');
  const tCommon = await getTranslations('common');

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
        <h1 className="min-w-0 flex-1 text-base font-bold leading-tight tracking-tight text-ink">
          {t('title')}
        </h1>
        {/* Un lien, pas un fetch : le navigateur télécharge le fichier lui-même. */}
        <a
          href="/api/vocabulary/export"
          download
          aria-label={t('exportLabel')}
          className="flex min-h-11 shrink-0 items-center rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-muted"
        >
          {t('export')}
        </a>
      </header>

      <main className="pb-safe flex-1 py-2">
        <VocabularyList />
        <p className="mt-6 px-1 text-xs leading-relaxed text-dim">{t('exportHint')}</p>
      </main>
    </div>
  );
}
