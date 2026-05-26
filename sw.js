/* ============================================================
   REQUISIÇÕES DIGITAL — SERVICE WORKER v8.4
   ============================================================ */

var CACHE_NAME = 'requisicoes-v8.4';
var ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (k) { return k !== CACHE_NAME; })
                    .map(function (k) { return caches.delete(k); })
            );
        })
    );
    self.clients.claim();
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', function (e) {
    // API calls → network only
    if (e.request.url.indexOf('script.google.com') !== -1) {
        e.respondWith(fetch(e.request));
        return;
    }

    // Static assets → network first, fallback cache (always gets latest)
    e.respondWith(
        fetch(e.request).then(function (response) {
            return caches.open(CACHE_NAME).then(function (cache) {
                cache.put(e.request, response.clone());
                return response;
            });
        }).catch(function () {
            return caches.match(e.request);
        })
    );
});
