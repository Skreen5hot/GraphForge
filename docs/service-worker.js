const CACHE_NAME = "query-browser-cache-v2.52"; //Update cache version to refresh Also update version in initializeApp()
const filesToCache = [
    "./",
    "index.html",
    "manifest.json?v=1.0.0",
    "styles/main.css",
    "scripts/app.js",
    "offline.html",
    "icons/web-app-manifest-192x192.png",
    "icons/web-app-manifest-512x512.png",
    "https://cdn.plot.ly/plotly-latest.min.js",
    "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"
];

// Install event - caches app shell files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caching app shell');
      return cache.addAll(filesToCache);
    }).catch(error => {
      console.error('Failed to cache:', error);
    })
  );
});

// Fetch event: Stale-While-Revalidate or Network-First strategies
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin === location.origin) {
      // Stale-While-Revalidate strategy for same-origin assets
      event.respondWith(
          caches.match(event.request).then((cachedResponse) => {
              const fetchPromise = fetch(event.request)
                  .then((networkResponse) => {
                      if (!networkResponse || networkResponse.status !== 200) {
                          return networkResponse;
                      }
                      // Clone the response for caching
                      const responseClone = networkResponse.clone();
                      caches.open(CACHE_NAME).then((cache) => {
                          cache.put(event.request, responseClone);
                      });
                      return networkResponse;
                  })
                  .catch((error) => {
                      console.error("Network fetch failed:", error);
                      return null;
                  });
              return cachedResponse || fetchPromise;
          })
      );
  } else {
      // Network-First strategy for third-party resources
      event.respondWith(
          fetch(event.request)
              .then((networkResponse) => {
                  if (!networkResponse || networkResponse.status !== 200) {
                      return networkResponse;
                  }
                  // Clone the response for caching
                  const responseClone = networkResponse.clone();
                  return caches.open(CACHE_NAME).then((cache) => {
                      cache.put(event.request, responseClone);
                      return networkResponse;
                  });
              })
              .catch(() => caches.match(event.request))
      );
  }
});

// Activate the service worker and clean up old caches
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
      caches.keys().then((cacheNames) => {
          return Promise.all(
              cacheNames.map((cacheName) => {
                  if (!cacheWhitelist.includes(cacheName)) {
                      console.log("Deleting old cache: ", cacheName);
                      return caches.delete(cacheName);
                  }
              })
          );
      })
  );
});
