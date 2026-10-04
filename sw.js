// Service Worker — SPK Tracker v3
// Strategi: network-first untuk HTML/manifest/SW, cache-first untuk aset lain
const CACHE = 'spk-tracker-v3';
const SHELL = ['./', './index.html', './manifest.json'];
const NETWORK_FIRST = ['/', '/index.html', '/manifest.json', '/sw.js'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
      .catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Jangan intercept request ke Apps Script / luar origin
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;

  const path = url.pathname || '/';
  const isNetworkFirst =
    NETWORK_FIRST.indexOf(path) >= 0 ||
    path.endsWith('/index.html') ||
    e.request.mode === 'navigate';

  if (isNetworkFirst) {
    // NETWORK-FIRST: coba ambil dari server, fallback ke cache kalau offline
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // CACHE-FIRST untuk aset statis
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
          }
          return res;
        });
      })
    );
  }
});
