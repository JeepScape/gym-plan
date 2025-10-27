
const CACHE = 'gym-plan-v4-' + self.registration.scope; // scope in name to bust old SW
const CORE = ['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return resp;
      }).catch(() => caches.match(req).then(r => r || caches.match('./offline.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(resp => {
        if (resp.ok && req.method === 'GET') {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
