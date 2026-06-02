/* ============================================================
   REQUISIÇÕES DIGITAL — SERVICE WORKER v8.8.0
   ============================================================ */

var CACHE_NAME = 'requisicoes-v9.0.0';
var ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

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

self.addEventListener('fetch', function (e) {
    if (e.request.url.indexOf('script.google.com') !== -1) {
        e.respondWith(fetch(e.request));
        return;
    }

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
