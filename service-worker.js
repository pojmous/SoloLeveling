
const CACHE_NAME = 'weekly-gate-pwa-v3';
const SCOPE = self.registration.scope; // ends with '/'
const assets = ['index.html','app.js','manifest.json','icons/icon-192x192.png','icons/icon-512x512.png'].map(p=>new URL(p, SCOPE).toString());

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
});

self.addEventListener('fetch', (event) => {
  const reqUrl = new URL(event.request.url);
  // Cache-first for same-origin
  if (reqUrl.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(resp => resp || fetch(event.request))
    );
  }
});
