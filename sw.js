/* 国博讲解手册 — service worker
 * 目的：首次打开后缓存页面与示例图片，展厅无网也能复习。
 * 更新内容后，把 CACHE 版本号 +1 即可让旧缓存失效。
 */
const CACHE = 'guobo-guide-v23';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './catalog.js',
  './content.js',
  './seed.js',
  './stories.js',
  './app.js',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon-180.png',
  './assets/seed/guanyu.jpg',
  './assets/seed/renmian.jpg',
  './assets/seed/yulong.jpg',
  './assets/seed/houmuwu.jpg',
  './assets/seed/siyang.jpg',
  './assets/seed/ligui.jpg',
  './assets/seed/wuwang.jpg',
  './assets/seed/shuochang.jpg',
  './assets/seed/xizun.jpg',
  './assets/seed/lotus.jpg',
  './assets/seed/sancai.jpg',
  './assets/seed/zhenban.jpg',
  './assets/seed/fengguan.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') >= 0) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
        return response;
      }).catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')).then((hit) => hit || new Response('', { status: 504 })))
    );
    return;
  }

  // 代码与样式优先走网络，保证更新能及时生效；断网时再回退缓存。
  const dynamic = request.destination === 'script' || request.destination === 'style';
  if (dynamic) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request).then((hit) => hit || new Response('', { status: 504 })))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => hit || new Response('', { status: 504 }));
    })
  );
});
