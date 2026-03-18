// LinkDrop Service Worker
// Handles PWA installation, basic caching, and share target

const CACHE_NAME = "linkdrop-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Share Target: When user shares a URL to LinkDrop (GET method),
// the browser navigates directly to /?autoUrl=... which the app handles.
// No extra SW logic needed for GET share target.

// Network-first fetch strategy for API calls, cache-first for assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip API requests and non-GET requests
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful HTML/JS/CSS responses
        if (
          response.ok &&
          (url.pathname === "/" ||
            url.pathname.endsWith(".js") ||
            url.pathname.endsWith(".css"))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback: serve cached version or root
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/");
        });
      })
  );
});
