const CACHE_NAME = 'visual-training-performance-v6';
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const asset = (path) => `${SCOPE_PATH}${path}` || path;
const STATIC_ASSETS = [
  asset('/'),
  asset('/index.html'),
  asset('/styles.css'),
  asset('/game.js'),
  asset('/config.js'),
  asset('/favicon.svg'),
  asset('/apple-touch-icon.svg'),
  asset('/manifest.webmanifest'),
  asset('/sound-compat.js'),
  asset('/vendor/p5.min.js')
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(asset('/index.html'))))
  );
});
