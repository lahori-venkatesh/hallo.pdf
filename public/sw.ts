/// <reference lib="webworker" />

const CACHE_NAME = 'hallopdf-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css',
  '/vite.svg'
];

self.addEventListener('install', (event: Event) => {
  const e = event as ExtendableEvent;
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event: Event) => {
  const e = event as FetchEvent;
  e.respondWith(
    caches.match(e.request)
      .then(response => response || fetch(e.request))
  );
});