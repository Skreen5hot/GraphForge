const CACHE_NAME = "query-browser-cache-v1";
const urlsToCache = [
    "./",
    "index.html",
    "styles/main.css",
    "scripts/app.js",
    "https://cdn.plot.ly/plotly-latest.min.js",
    "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"
];

// Install event - caches the app shell (HTML, CSS, JS files)
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("Opened cache");
            return cache.addAll(urlsToCache);
        })
    );
});

// Activate event - clears old caches if the CACHE_NAME has changed
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log("Deleting old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - serves cached files when offline
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Serve from cache if found, else fetch from network
            return response || fetch(event.request).then((fetchResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    // Cache the fetched response for future use
                    cache.put(event.request, fetchResponse.clone());
                    return fetchResponse;
                });
            });
        }).catch(() => {
            // Optional fallback if needed for specific requests
            if (event.request.mode === 'navigate' && !response) {
                return caches.match("./index.html");
            }
        })
    );
});
