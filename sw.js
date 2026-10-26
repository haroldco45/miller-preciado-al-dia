// Miller Preciado al Día — service worker
const CACHE = 'miller-al-dia-v1';
const BASE = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png',
  'img/miller-perfil.jpg', 'img/reel-arandanos.jpg', 'img/reel-dream-berries.jpg', 'img/reel-estudio.jpg',
  'data/noticias.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Noticias y página: primero la red, para que siempre esté al día
  if (url.pathname.endsWith('noticias.json') || e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(url.pathname.endsWith('noticias.json') ? 'data/noticias.json' : e.request, copia));
      return r;
    }).catch(() => caches.match(url.pathname.endsWith('noticias.json') ? 'data/noticias.json' : e.request).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
