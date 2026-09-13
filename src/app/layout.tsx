import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return {
    title: t('name'),
    description: t('tagline'),
    applicationName: 'cuecard',
  };
}

export const viewport: Viewport = {
  themeColor: '#07080b',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // Le lecteur est fait pour être lu sans zoomer, mais interdire le zoom
  // priverait une mauvaise vue de son seul recours.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-night text-ink antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
