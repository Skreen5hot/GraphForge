const CACHE_NAME = "query-browser-cache-v1";
const urlsToCache = [
    "./",
    "index.html",
    'manifest.json',
    "styles/main.css",
    "scripts/app.js",
    'offline.html',
    'images/icon-192x192.png',
    'images/icon-512x512.png',
    "https://cdn.plot.ly/plotly-latest.min.js",
    "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"
];

// Install event - caches app shell files
self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(cacheName).then(cache => {
        console.log('Caching app shell');
        return cache.addAll(filesToCache);
      })
    );
  });
  
  // Activate event - clears old caches
  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== cacheName) {
              console.log('Clearing old cache');
              return caches.delete(cache);
            }
          })
        );
      })
    );
  });
  
  self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Serve `index.html` for navigation requests if no cache match is found
            if (event.request.mode === 'navigate') {
                return response || caches.match('/index.html');
            }
            // For other requests, serve cached response or fetch from network, with a fallback to offline.html
            return response || fetch(event.request).catch(() => caches.match('/offline.html'));
        }).catch((error) => {
            console.error('Fetch failed; returning offline page instead.', error);
            return caches.match('/offline.html');
        })
    );
});

    