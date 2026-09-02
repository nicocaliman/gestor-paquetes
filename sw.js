// Note 1: Progressive Web App (PWA) Service Worker Lifecycle & Offline Caching Architecture
// A Service Worker is an event-driven background script running independently of the web page context.
// It acts as a client-side network proxy, intercepting HTTP requests to enable offline capabilities.

// Note 2: Cache Identifier and Versioning
// Changing this version string triggers the Service Worker activation phase to purge obsolete cached assets.
const CACHE_NAME = 'nc-caliman-v107';

// Note 3: Static Asset Manifest for Offline Pre-caching
// List of critical shell resources required to load the user interface even without an active internet connection.
const ASSETS = [
  './',
  './index.html',
  './src/app.js',
  './manifest.json',
  './icon.svg'
];

// Note 4: Service Worker Installation Event
// Fires when the browser registers the Service Worker for the first time or detects a new version.
// e.waitUntil() delays installation until all core application shell assets are fully downloaded and cached.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Note 5: Pre-fetching Shell Assets into Cache Storage API
      return cache.addAll(ASSETS);
    }).then(() => {
      // Note 6: Immediate Activation Request
      // Forces the waiting Service Worker to become the active worker without waiting for open clients to close.
      return self.skipWaiting();
    })
  );
});

// Note 7: Service Worker Activation & Cache Cleanup Event
// Fires after installation completes. Used for clearing legacy cache buckets from previous versions.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Note 8: Remove outdated cache instances to prevent storage leaks
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Note 9: Claim Uncontrolled Clients
      // Allows the activated Service Worker to immediately control active browser tabs without requiring a page reload.
      return self.clients.claim();
    })
  );
});

// Note 10: Fetch Event Interception & Network Proxy Strategy
// Intercepts all outgoing HTTP/HTTPS GET requests from the application.
self.addEventListener('fetch', (e) => {
  // Note 11: Network Bypass for Realtime Cloud API
  // Requests targeting Supabase Realtime endpoints must bypass local cache to ensure immediate WebSocket synchronization.
  if (e.request.url.includes('supabase.co')) {
    return;
  }

  // Note 12: Stale-While-Revalidate Caching Strategy
  // Returns cached assets instantly for maximum speed while asynchronously fetching updates from the network in the background.
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Note 13: Background Revalidation Task
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {
          // Note 14: Silently handle network failure when offline; cached response is already served.
        });
        return cachedResponse;
      }

      // Note 15: Cache Miss Handler - Fetch from Network and Store
      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && e.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});
