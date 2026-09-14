import { getTranslations } from 'next-intl/server';
import { DownloadSimple, ICON, iconProps } from '@/components/icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { VocabularyList } from '@/components/VocabularyList';

export default async function VocabularyPage() {
  const t = await getTranslations('vocabulary');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4">
      <ScreenHeader
        title={t('title')}
        backHref="/"
        action={
          // Un lien, pas un fetch : le navigateur télécharge le fichier lui-même.
          <a
            href="/api/vocabulary/export"
            download
            aria-label={t('exportLabel')}
            className="press -mr-1 flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted"
          >
            <DownloadSimple size={ICON} {...iconProps} />
            {t('export')}
          </a>
        }
      />

      <main className="pb-safe flex-1 py-2">
        <VocabularyList />
        <p className="mt-8 text-xs leading-relaxed text-dim">{t('exportHint')}</p>
      </main>
    </div>
  );
}
