const CACHE_NAME = "query-browser-cache-v1";
const urlsToCache = [
    "./",
    "index.html",
    "manifest.json",
    "service-worker.js",
    "styles/main.css",
    "scripts/app.js",
    "offline.html",
    "images/icon-192x192.png",
    "images/icon-512x512.png"
];

// External URLs (may fail due to CORS policies)
const externalUrls = [
    "https://cdn.plot.ly/plotly-latest.min.js",
    "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"
];

// Install event - caches app shell files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Failed to cache app shell:', error);
            })
    );
});

// Activate event - clears old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Fetch event - serves cached content when offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Handle navigation requests
            if (event.request.mode === 'navigate') {
                return response || caches.match('./');
            }
            // For all other requests, return the cached response or fetch from network
            return response || fetch(event.request).catch(() => caches.match('offline.html'));
        }).catch((error) => {
            console.error('Fetch failed; returning offline page instead.', error);
            return caches.match('offline.html');
        })
    );
});

// Optional: Try caching external URLs (may fail)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return Promise.all(
                    externalUrls.map(url =>
                        fetch(url, { mode: 'no-cors' })
                            .then(response => cache.put(url, response))
                            .catch(error => console.warn(`External asset not cached: ${url}`, error))
                    )
                );
            })
    );
});
