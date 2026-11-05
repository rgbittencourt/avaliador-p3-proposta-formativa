const CACHE = 'avaliador-p3-shell-v1';
const SHELL = ['/', '/app.js', '/p3-core.js', '/extrator.js', '/vendor/pdf.min.js', '/vendor/pdf.worker.min.js', '/manifest.webmanifest', '/favicon.svg', '/assets/icon-192.png', '/assets/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(event.request)
      .then((resp) => { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(event.request, copy)); return resp; })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});
