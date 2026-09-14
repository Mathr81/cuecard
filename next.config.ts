import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Sortie autonome : l'image Docker n'embarque que le serveur et les
  // dépendances réellement atteintes, pas tout node_modules.
  output: 'standalone',
  // better-sqlite3 est un binaire natif : il doit rester hors du bundle.
  serverExternalPackages: ['better-sqlite3'],
  images: {
    // Les affiches viennent de TMDB et de nulle part d'autre.
    remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' }],
  },
};

export default withNextIntl(nextConfig);
