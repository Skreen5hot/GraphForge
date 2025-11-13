const CACHE_NAME = "query-browser-cache-v2.54"; // Increment this version to force a service worker update and re-cache the app shell.
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
          caches.match(event.request).then(cachedResponse => {
              const networkFetch = fetch(event.request)
                  .then(networkResponse => {
                      // Update cache with fresh network response
                      caches.open(CACHE_NAME).then(cache => {
                          cache.put(event.request, networkResponse.clone());
                      });
                      return networkResponse;
                  })
                  .catch(() => {
                      // Network failed. If we have a cached response, it's already returned.
                      // If not, and it's a navigation request, serve offline.html.
                      if (!cachedResponse && event.request.mode === 'navigate') {
                          console.warn('Offline and no cache for navigation request:', event.request.url);
                          return caches.match('offline.html');
                      }
                      console.warn('Network fetch failed for:', event.request.url);
                      return null; // Let the browser handle the error if no fallback
                  });

              // Return cached response immediately if available, otherwise wait for network fetch
              return cachedResponse || networkFetch;
          })
      );
  } else {
      // Network-First strategy for third-party resources
      event.respondWith(
          fetch(event.request)
            .then(networkResponse => {
                // Clone the response right away.
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                // Return the original response to the browser.
                return networkResponse;
            }).catch(() => caches.match(event.request))
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
