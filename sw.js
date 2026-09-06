const CACHE = 'blink-tax-v20';
const SHELL = ['./index.html', './manifest.webmanifest', './icons/icon.svg'];
const ASSET_PATTERN = /\.(?:js|css|wasm|task|png|jpe?g|gif|svg|webp|ico|webmanifest)(?:$|\?)/i;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('blink-tax-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const isAssetRequest = (request) => request.destination === 'script'
  || request.destination === 'style'
  || request.destination === 'image'
  || request.destination === 'manifest'
  || ASSET_PATTERN.test(new URL(request.url).pathname);

const isHtmlResponse = (response) => (response.headers.get('content-type') || '').toLowerCase().includes('text/html');

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put('./index.html', copy)).catch(() => undefined));
      }
      return response;
    }).catch(() => caches.match('./index.html').then(cached => cached || Response.error())));
    return;
  }

  if (!isAssetRequest(request)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Never turn a server-side HTML error/fallback into a cached asset.
        if (response.ok && !isHtmlResponse(response)) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  );
});
