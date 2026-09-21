/* Offline-first service worker. Cache-first for app shell. */
const CACHE = "hanuman-run-duel-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./assets/hanuman-hero.png",
  "./assets/hanuman-runner-v2.png",
  "./assets/biome-jungle-v2.jpg",
  "./assets/biome-coast-v2.jpg",
  "./assets/biome-sea-v2.jpg",
  "./assets/biome-lanka-v2.jpg",
  "./css/styles.css",
  "./js/utils.js",
  "./js/storage.js",
  "./js/audio.js",
  "./js/input.js",
  "./js/particles.js",
  "./js/world.js",
  "./js/player.js",
  "./js/obstacles.js",
  "./js/duel.js",
  "./js/game.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
