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

// public/sw.js
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  event.waitUntil(self.registration.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});