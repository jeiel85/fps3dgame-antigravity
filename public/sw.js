/* CYBERSHOCK 3D 서비스워커 — 오프라인 재방문과 설치형 PWA 지원.
 * 내비게이션: network-first(오프라인이면 캐시된 index.html)
 * 같은 출처 정적 자산: stale-while-revalidate
 * 자산이 바뀌면 CACHE_VERSION을 올려 이전 캐시를 정리한다. */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `cybershock3d-${CACHE_VERSION}`;
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('cybershock3d-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

function putInCache(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    putInCache(request, response);
    return response;
  } catch (error) {
    const cached = (await caches.match(request, { ignoreSearch: true }))
      || (await caches.match('./index.html'))
      || (await caches.match('./'));
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      putInCache(request, response);
      return response;
    });
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});
