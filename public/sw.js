// public/sw.js  — classic worker, not a module
/* global self */
self.skipWaiting();
self.addEventListener('activate', () => self.clients.claim());

// Load Workbox for classic SW
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// If Workbox failed to load, avoid breaking registration
if (!self.workbox) {
  // no-op
} else {
  const { precaching, core } = self.workbox;

  // Bump this when changing SW to force updates
  const SW_VERSION = 'v4';

  core.setCacheNameDetails({ prefix: 'site' });
  precaching.cleanupOutdatedCaches();

  // Filter out Next.js internal manifests that may 404 on Netlify
  const manifest = (self.__WB_MANIFEST || []).filter((entry) => {
    const url = typeof entry === 'string' ? entry : entry.url;
    return !/\/_next\/(app-build-manifest|build-manifest|react-loadable-manifest|middleware-manifest|prerender-manifest)\.json$/.test(url);
  });

  // Ignore all URL params when matching precached entries
  precaching.precacheAndRoute(manifest, { ignoreURLParametersMatching: [/.*/] });
}
