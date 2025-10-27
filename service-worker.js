// v6 service worker — network-first for fitness.json and plan.json
const CACHE = 'gym-plan-v6';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './offline.html',
  './icon-192.png',
  './icon-512.png'
];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(()=>{})));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(url.pathname.endsWith('/fitness.json') || url.pathname.endsWith('/plan.json')){
    e.respondWith(fetch(new Request(e.request,{cache:'no-store'})).then(r=>{
      const copy = r.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); return r;
    }).catch(()=>caches.match(e.request)));
    return;
  }
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).catch(()=>caches.match('./offline.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{
    const copy = r.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); return r;
  })));
});
