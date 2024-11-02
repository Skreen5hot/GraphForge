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
    "images/icon-512x512.png",
    "https://cdn.plot.ly/plotly-latest.min.js",
    "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"
];

// Install event - caches app shell files
self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        console.log('Caching app shell');
        return cache.addAll(filesToCache);
      })
    );
  });
  
  // Activate event - clears old caches
  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys().then(CACHE_NAMEs => {
        return Promise.all(
          CACHE_NAMEs.map(cache => {
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
  self.addEventListener('fetch', event => {
      event.respondWith(
        caches.match(event.request).then(response => {
          // If the request is for the root path, return `index.html`
          if (event.request.mode === 'navigate' && !response) {
            return caches.match('./index.html');
          }
          // Return the cached response if found, or fetch from network if not cached
          return response || fetch(event.request).catch(() => caches.match('offline.html'));
        })
      );
    });
    
    