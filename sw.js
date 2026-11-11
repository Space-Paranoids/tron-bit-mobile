// Offline support: everything Bit needs is stored on first visit and served
// from the device after that. Bump VERSION whenever any file changes.
const VERSION = "bit-v7";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "bit.bin",
  "manifest.webmanifest",
  "fonts/orbitron.ttf",
  "sounds/yes.mp3",
  "sounds/no.mp3",
  "sounds/yesyesyes.mp3",
  "sounds/nonono.mp3",
  "icons/favicon.png",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only this site's own files are ever served; anything else goes untouched.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
  );
});
