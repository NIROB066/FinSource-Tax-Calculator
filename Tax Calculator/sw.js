const STATIC_CACHE = 'finsource-tax-static-v2';
const RUNTIME_CACHE = 'finsource-tax-runtime-v2';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './calculator.js?v=20260622',
  './manifest.json',
  './icon.png',
  './sw.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName !== STATIC_CACHE && cacheName !== RUNTIME_CACHE) {
          return caches.delete(cacheName);
        }
        return null;
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    if (requestUrl.hostname.includes('fonts.googleapis.com') || requestUrl.hostname.includes('fonts.gstatic.com')) {
      event.respondWith(staleWhileRevalidate(event.request, RUNTIME_CACHE));
    }
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, './index.html'));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const fallbackCache = await caches.open(STATIC_CACHE);
    return fallbackCache.match(fallbackUrl);
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkPromise;
}
