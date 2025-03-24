// public/sw.ts
const CACHE_NAME = 'hallopdf-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Use `globalThis` instead of `self`
const globalScope = globalThis as unknown as ServiceWorkerGlobalScope;

// Install event: Cache the assets
globalScope.addEventListener('install', (event: ExtendableEvent) => {
  console.log('Service Worker installed');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache: Cache) => {
      console.log('Caching assets...');
      return cache.addAll(ASSETS);
    }).then(() => globalScope.skipWaiting())
  );
});

// Activate event: Clean up old caches
globalScope.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames: string[]) => {
      return Promise.all(
        cacheNames
          .filter((cache: string) => cache !== CACHE_NAME)
          .map((cache: string) => caches.delete(cache))
      );
    }).then(() => globalScope.clients.claim())
  );
});

// Fetch event: Serve cached assets or fetch from network
globalScope.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== globalScope.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse: Response | undefined) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse: Response) => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache: Cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        return caches.match('/index.html') as Promise<Response>;
      });
    })
  );
});