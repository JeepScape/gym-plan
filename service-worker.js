// v5 service worker
const CACHE = 'gym-plan-v5-' + (self.registration.scope || 'scope');

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([
      './',
      './index.html',
      './manifest.webmanifest',
      './offline.html',
      './icon-192.png',
      './icon-512.png',
      './fitness.json'
    ]).catch(()=>{}))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./offline.html')));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return resp;
    }))
  );
});
