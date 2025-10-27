
// Emergency SW: wipe caches, then unregister
self.addEventListener('install', (e)=>{
  self.skipWaiting();
});
self.addEventListener('activate', (e)=>{
  e.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    // Give pages control
    await self.clients.claim();
    // Unregister this SW so future loads are clean
    await self.registration.unregister();
  })());
});
// For any fetch, just try network; fallback none (we're in safe mode)
self.addEventListener('fetch', (e)=>{
  e.respondWith(fetch(e.request).catch(()=>new Response('', {status: 502})));
});
