import type { MetadataRoute } from 'next';
import messages from '@/messages/fr.json';

/** Le manifeste est servi une seule fois, hors de toute requête localisée :
 *  il porte la langue par défaut de l'app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.app.name,
    short_name: messages.app.name,
    description: messages.app.tagline,
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#07080b',
    theme_color: '#07080b',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
