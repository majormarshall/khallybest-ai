// ============================================================
//  KHALLYBEST — Service Worker v4.0
//  Network-first for app shell (fixes mobile Chrome refresh bug)
//  Cache-fallback for offline resilience
// ============================================================
const CACHE = 'KHALLYBEST-v4';
const SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/config.js',
  '/style.css',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600&family=Fira+Code:wght@400;500&display=swap'
];

// Handle skip-waiting message from the app (for instant updates)
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Install — pre-cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .catch(() => {})
  );
  self.skipWaiting(); // activate immediately
});

// Activate — delete ALL old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — NETWORK-FIRST for app shell, bypass for APIs
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  // Bypass: external APIs and image generation — always live
  if (
    url.includes('api.groq.com') ||
    url.includes('api.coingecko') ||
    url.includes('wttr.in') ||
    url.includes('duckduckgo') ||
    url.includes('image.pollinations.ai') ||
    url.includes('fonts.gstatic.com')
  ) return;

  // Network-first strategy: try network, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Only cache valid responses
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        // Network failed — serve from cache (offline fallback)
        return caches.match(e.request).then(cached => {
          return cached || caches.match('/index.html');
        });
      })
  );
});
