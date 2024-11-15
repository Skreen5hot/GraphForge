const CACHE_NAME = "query-browser-cache-v1";
const filesToCache = [
    "./",
    "index.html",
    "manifest.json",
    "service-worker.js",
    "styles/main.css",
    "scripts/app.js",
    "offline.html",
    "images/web-app-manifest-192x192.png",
    "images/web-app-manifest-512x512.png",
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
  
// Fetch event - serves cached content when offline and handles dynamic URL fetching
self.addEventListener('fetch', event => {
  // Check if the request is for a specific dynamic URL (like .owl files or external resources)
  const requestUrl = new URL(event.request.url);

  // If the request is for fetching an external resource (e.g., using 'fetch-remote' as a pattern in URL)
  if (requestUrl.pathname === '/fetch-remote') {
    const externalUrl = requestUrl.searchParams.get('url'); // Get the URL from query params
    
    if (externalUrl) {
      // Handle dynamic fetching for external resources like .owl files
      event.respondWith(
        fetch(externalUrl).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            return networkResponse.text(); // Assuming the content is text (like an owl file)
          } else {
            return new Response('Error fetching the external file', { status: 500 });
          }
        }).catch(() => {
          return new Response('Network error while fetching external file', { status: 500 });
        })
      );
      return; // Exit the fetch handler for this specific case
    }
  }

  // If the request is not for an external resource, continue with the default cache and network logic
  event.respondWith(
    caches.match(event.request).then(response => {
      if (event.request.mode === 'navigate' && !response) {
        return caches.match('./index.html');
      }

      return response || fetch(event.request).then(networkResponse => {
        // Clone the network response only if it is successful
        if (networkResponse && networkResponse.ok) {
          const clonedResponse = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clonedResponse);
          });
        }
        return networkResponse; // Return the original response
      }).catch(() => {
        return caches.match('offline.html');
      });
    }).catch(error => {
      console.error('Fetching failed:', error);
      return caches.match('offline.html');
    })
  );
});


  