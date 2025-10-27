// v6 service worker — network-first for fitness.json
const CACHE = 'gym-plan-v6-' + (self.registration.scope || 'scope');

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './offline.html',
  './icon-192.png',
  './icon-512.png',
  // NOTE: fitness.json is intentionally NOT in the precache
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(()=>{}))
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
  const url = new URL(req.url);

  // Always network-first for fitness.json so the dashboard shows fresh data
  if (url.pathname.endsWith('/fitness.json')) {
    e.respondWith(
      fetch(new Request(req, { cache: 'no-store' }))
        .then(r => {
          // Optionally update cache with latest copy
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req) || new Response('{"workouts":[]}', {
          headers: { 'Content-Type': 'application/json' }
        }))
    );
    return;
  }

  // For navigations, use network-first with offline fallback
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./offline.html'))
    );
    return;
  }

  // Everything else: cache-first
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return resp;
    }))
  );
});
