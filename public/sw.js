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
      caches.open('time-macros-v1').then((cache) => {
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

  self.addEventListener('fetch', (event) => {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  });
} else {
  const { precaching, core, strategies, routing } = self.workbox;

  // Bump this when changing SW to force updates
  const SW_VERSION = 'v5';

  core.setCacheNameDetails({ prefix: 'time-macros' });
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
      plugins: [
        new core.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    })
  );

  // Cache images with cache-first strategy
  routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new strategies.CacheFirst({
      cacheName: 'images',
      plugins: [
        new core.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
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
  
  if (event.data && event.data.type === 'CACHE_DATA') {
    // Cache important data for offline use
    event.waitUntil(
      caches.open('user-data').then((cache) => {
        return cache.put('/user-data-backup', new Response(JSON.stringify(event.data.data)));
      })
    );
  }
});

// Background sync for data persistence
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Sync any pending data when connection returns
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'BACKGROUND_SYNC_COMPLETE',
      timestamp: Date.now()
    });
  });
}
