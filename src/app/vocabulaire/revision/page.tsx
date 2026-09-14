import { getTranslations } from 'next-intl/server';
import { ReviewSession } from '@/components/ReviewSession';
import { ScreenHeader } from '@/components/ScreenHeader';

export default async function ReviewPage() {
  const t = await getTranslations('vocabulary');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4">
      <ScreenHeader title={t('review')} backHref="/vocabulaire" />

      <main className="flex flex-1 flex-col py-2">
        <ReviewSession />
      </main>
    </div>
  );
}
