const CACHE_NAME = 'uc-fund-shell-v925-profitability';
const OFFLINE_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS).catch(() => {}))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const accept = event.request.headers.get('accept') || '';
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(res => { if(res.ok){const copy=res.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}return res; }).catch(()=>caches.match(event.request).then(v=>v||caches.match('/'))));
  } else if (event.request.destination === 'script' || event.request.destination === 'style' || event.request.url.includes('/_next/static/')) {
    // Prefer the deployed bundle when online; stale cached JS can make buttons appear unresponsive.
    event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy));}return res;}).catch(()=>caches.match(event.request)));
  } else if (accept.includes('image') || event.request.url.includes('/icons/')) {
    // Prefer the deployed bundle when online; stale cached JS can make buttons appear unresponsive.
    event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy));}return res;}).catch(()=>caches.match(event.request)));
  }
});
