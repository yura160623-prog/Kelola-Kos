// KelolaKos Service Worker - offline-lite caching (PRD sec. 5)
const CACHE = 'kelolakos-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/vendor/alpine.min.js',
  '/manifest.json',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API calls: network-first (fresh data), no offline cache of mutations.
  if (url.pathname.startsWith('/api/')) {
    return; // let the browser handle; app shows errors when offline
  }

  // Static assets & navigation: cache-first, fall back to network then cache shell.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});
