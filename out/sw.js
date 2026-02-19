// Enhanced Service Worker for PWA and offline data persistence
/* global self */
self.skipWaiting();
self.addEventListener('activate', () => self.clients.claim());

// Load Workbox for enhanced SW functionality
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// If Workbox failed to load, avoid breaking registration
if (!self.workbox) {
  // Fallback: basic caching without Workbox
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open('time-macros-v6-vercel').then((cache) => {
        return cache.addAll([
          '/',
          '/calendar',
          '/settings',
          '/connect',
          '/manifest.json'
        ]);
      })
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== 'time-macros-v6-vercel') {
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  });

  self.addEventListener('fetch', (event) => {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  });
} else {
  const { precaching, strategies, routing } = self.workbox;

  // Bump this when changing SW to force updates
  const SW_VERSION = 'v6-vercel';

  precaching.cleanupOutdatedCaches();

  // Filter out Next.js internal manifests that may 404 on Netlify
  const manifest = (self.__WB_MANIFEST || []).filter((entry) => {
    const url = typeof entry === 'string' ? entry : entry.url;
    return !/\/_next\/(app-build-manifest|build-manifest|react-loadable-manifest|middleware-manifest|prerender-manifest)\.json$/.test(url);
  });

  // Ignore all URL params when matching precached entries
  precaching.precacheAndRoute(manifest, { ignoreURLParametersMatching: [/.*/] });

  // Cache API responses for offline use
  routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new strategies.NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 3,
      cacheKeyWillBeUsed: async ({ request }) => {
        const url = new URL(request.url);
        return `${url.pathname}${url.search}`;
      }
    })
  );

  // Cache static assets with stale-while-revalidate strategy
  routing.registerRoute(
    ({ request }) => request.destination === 'style' || request.destination === 'script',
    new strategies.StaleWhileRevalidate({
      cacheName: 'static-assets',
    })
  );

  // Cache images with cache-first strategy
  routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new strategies.CacheFirst({
      cacheName: 'images',
    })
  );

  // Handle offline fallback
  routing.setCatchHandler(({ event }) => {
    if (event.request.destination === 'document') {
      return caches.match('/offline.html');
    }
    return Response.error();
  });
}

// Enhanced data persistence for home screen apps
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
