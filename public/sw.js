const CACHE = 'ligalab-offline-v1';
// Cache only the offline notice. Never store league responses, credentials, or admin pages.
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('/offline.html')));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ligalab-offline-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match('/offline.html')) || new Response('Sin conexión. Vuelve a abrir LigaLab cuando tengas internet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
});
