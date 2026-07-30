// Offline support for Zombie Noobs.
//
// The point of this file is that the game works on a plane. Open it once with a
// connection and everything it needs is copied onto the device; after that it loads
// from the device whether there is signal or not.
//
// Bump CACHE when the game changes. The old cache is thrown away on activate, so a
// new version never gets served stale files from an old one.
const CACHE = 'zombie-noobs-v50';

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/anthem-1977.mp3',
  './assets/anthem-usa.mp3',
  './assets/anthem-france.mp3',
  './assets/anthem-germany.mp3',
  './assets/anthem-japan.mp3',
  './assets/anthem-italy.mp3',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // One missing file must not fail the whole install, or the game ends up with
      // no offline copy at all because of one asset. Each is added on its own.
      .then(cache => Promise.all(FILES.map(f =>
        cache.add(new Request(f, { cache: 'reload' })).catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first so a new version is picked up as soon as there is a connection,
// falling back to the cached copy when there is none. The other way round would mean
// Josh keeps seeing an old build every time something is fixed.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then(res => {
        // Keep the cached copy up to date for the next time there is no signal.
        if (res && res.ok && res.type !== 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
