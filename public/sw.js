/**
 * Je perds parfois le wifi au milieu d'un film. Les répliques sont déjà dans
 * IndexedDB ; ce qu'il manque pour continuer, c'est que la coquille de l'app
 * se charge sans réseau. C'est tout ce que fait ce worker.
 */
const VERSION = 'cuecard-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const DICTIONARY_CACHE = `${VERSION}-dictionary`;

/** Les pages utilisables hors ligne : le lecteur d'abord, c'est lui qui sert. */
const SHELL = ['/reader', '/', '/vocabulaire'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Une page qui ne répond pas ne doit pas faire échouer toute l'installation.
      .then((cache) => Promise.allSettled(SHELL.map((path) => cache.add(path))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = (await caches.match(request)) ?? (await caches.match('/reader'));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Un mot déjà consulté reste consultable hors ligne ; sinon on attend le réseau.
  const response = cached ?? (await network);
  if (response) return response;
  return new Response(JSON.stringify({ error: 'network' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (url.pathname.startsWith('/api/dictionary/')) {
    event.respondWith(staleWhileRevalidate(request, DICTIONARY_CACHE));
  }
});
