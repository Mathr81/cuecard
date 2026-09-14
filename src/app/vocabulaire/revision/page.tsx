import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ReviewSession } from '@/components/ReviewSession';

export default async function ReviewPage() {
  const t = await getTranslations('vocabulary');
  const tCommon = await getTranslations('common');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4">
      <header className="pt-safe flex items-center gap-2 py-3">
        <Link
          href="/vocabulaire"
          aria-label={tCommon('back')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-muted"
        >
          ←
        </Link>
        <h1 className="flex-1 text-lg font-bold tracking-tight text-ink">{t('review')}</h1>
      </header>

      <main className="flex flex-1 flex-col py-2">
        <ReviewSession />
      </main>
    </div>
  );
}
