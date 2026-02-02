const CACHE_NAME = "assist-items-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/app.js",
  "./js/data-manager.js",
  "./icon-v5-192.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});
