const CACHE_NAME = "suhail-live-wallpapers-v7";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/styles.css",
  "./assets/js/app.js",
  "./assets/icons/icon.svg",
  "./assets/images/suhail-saeedy-about-approved.jpeg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Wallpaper catalog is intentionally online-only.
  if (url.pathname.endsWith("/data/wallpapers.json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => new Response(
        JSON.stringify({ offline: true }),
        { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      ))
    );
    return;
  }

  // Navigation remains available offline after the first successful visit/install.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // App-shell assets use cache-first with background refresh.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== "opaque") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);

      return cached || network;
    })
  );
});