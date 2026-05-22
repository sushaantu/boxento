const CACHE_NAME = 'boxento-cache-v2';
const STATIC_URLS = [
  '/index.html',
  '/favicon.ico',
  '/favicon.svg',
  '/manifest.json',
  '/sounds/bell.mp3',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

const STATIC_URL_SET = new Set(STATIC_URLS);

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_URLS);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }

          return undefined;
        })
      ))
      .then(() => self.clients.claim())
  );
});

const fetchAndUpdateCache = async (request) => {
  const response = await fetch(request);

  if (response && response.status === 200 && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
};

const networkFirst = async (request, fallbackUrl) => {
  try {
    return await fetchAndUpdateCache(request);
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (fallbackUrl) {
      const fallbackResponse = await caches.match(fallbackUrl);
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }

    throw error;
  }
};

const cacheFirst = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  return fetchAndUpdateCache(request);
};

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/index.html'));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (STATIC_URL_SET.has(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(fetch(request));
});
