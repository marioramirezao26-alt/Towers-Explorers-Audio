self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough: no cacheamos nada, solo cumplimos el requisito de Android
// de tener un service worker con un manejador de "fetch" para poder instalarse.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
