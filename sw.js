// Service Worker — SPK Tracker v4
// Strategi: network-first untuk HTML/SW/manifest, cache-first untuk aset lain
const CACHE = 'spk-tracker-v4';
const SHELL = ['./', './index.html', './manifest.json'];

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
  const isHTML = e.request.mode === 'navigate' || path.endsWith('.html') || path === '/' || path.endsWith('/');
  const isSW = path.endsWith('sw.js');
  const isManifest = path.endsWith('manifest.json');
  const isNetworkFirst = isHTML || isSW || isManifest;

  if (isNetworkFirst) {
    // NETWORK-FIRST dengan no-store — selalu cek versi baru
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
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
