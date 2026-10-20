/* CYBERSHOCK 3D 서비스워커 — 오프라인 재방문과 설치형 PWA 지원.
 * 설치: index.html·manifest·아이콘 + index.html이 참조하는 빌드 JS/CSS(앱 셸)를 프리캐시
 * 내비게이션: network-first(오프라인이면 캐시된 index.html)
 * 같은 출처 정적 자산: stale-while-revalidate
 * 자산 구성이 바뀌면 CACHE_VERSION을 올려 이전 캐시를 정리한다. */
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

// 첫 방문에는 서비스워커가 load 이후에 등록되어 번들 요청을 가로채지 못한다.
// 그래서 설치 시 index.html이 참조하는 같은 출처 JS/CSS(해시가 붙은 빌드 산출물)를 함께 캐시한다.
async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(PRECACHE_URLS);
  const indexUrl = new URL('./index.html', self.location.href);
  const indexResponse = await cache.match(indexUrl.href);
  if (!indexResponse) return;
  const html = await indexResponse.text();
  const shellUrls = new Set();
  for (const match of html.matchAll(/\b(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    const url = new URL(match[1], indexUrl);
    if (url.origin === self.location.origin) shellUrls.add(url.href);
  }
  await cache.addAll([...shellUrls]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
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

// 캐시 쓰기 promise를 돌려주어 호출 측이 event.waitUntil로 이벤트 수명을 연장할 수 있게 한다.
function putInCache(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return Promise.resolve();
  const copy = response.clone();
  return caches.open(CACHE_NAME)
    .then((cache) => cache.put(request, copy))
    .catch((error) => console.warn('[sw] 캐시 저장 실패:', request.url, error));
}

async function networkFirst(event) {
  const { request } = event;
  try {
    const response = await fetch(request);
    event.waitUntil(putInCache(request, response));
    return response;
  } catch (error) {
    const cached = (await caches.match(request, { ignoreSearch: true }))
      || (await caches.match(new URL('./index.html', self.location.href).href))
      || (await caches.match(new URL('./', self.location.href).href));
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cached = await caches.match(request);
  const network = fetch(request).then((response) => {
    event.waitUntil(putInCache(request, response));
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
    event.respondWith(networkFirst(event));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});
