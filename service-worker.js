const CACHE_NAME = "suhail-live-wallpapers-v16";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/styles.css?v=16",
  "./assets/js/app.js?v=16",
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

function remember(request, response) {
  if (response && response.status === 200 && response.type !== "opaque") {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
  }
  return response;
}

function networkFirst(request, fallbackUrl) {
  return fetch(request, { cache: "no-store" })
    .then(response => remember(request, response))
    .catch(() => caches.match(request).then(cached => cached || (fallbackUrl ? caches.match(fallbackUrl) : undefined)));
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && url.pathname.endsWith("/data/wallpapers.json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => new Response(
        JSON.stringify({ offline: true }),
        { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      ))
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, "./index.html"));
    return;
  }

  if (sameOrigin) {
    const path = url.pathname;
    const freshAsset =
      path.endsWith("/assets/js/app.js") ||
      path.endsWith("/assets/css/styles.css") ||
      path.endsWith("/manifest.webmanifest") ||
      path.includes("/assets/wallpapers/") ||
      path.includes("/assets/images/");

    if (freshAsset) {
      event.respondWith(networkFirst(event.request));
      return;
    }
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => remember(event.request, response)))
  );
});
