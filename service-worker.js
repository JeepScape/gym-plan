// Minimal SW: network-first for JSON; cache-first for shell.
const CACHE = 'gp-shell-v5';
const SHELL = ['./', './index.html', './offline.html', './manifest.webmanifest'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  const isJSON = url.pathname.endsWith('/fitness.json') || url.pathname.endsWith('/plan.json');
  if(isJSON){
    e.respondWith((async()=>{
      try{ 
        const net = await fetch(e.request, {cache:'no-store'});
        const clone = net.clone();
        const c = await caches.open(CACHE); c.put(e.request, clone);
        return net;
      }catch(_){
        const match = await caches.match(e.request);
        return match || new Response('{}', {headers:{'content-type':'application/json'}});
      }
    })());
    return;
  }
  // shell
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request).catch(()=> caches.match('./offline.html'))));
});
