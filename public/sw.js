/* eslint-disable no-undef */
import {precacheAndRoute, cleanupOutdatedCaches} from 'workbox-precaching';

const SW_VERSION = 'v3'; // bump on each SW change

self.skipWaiting();
self.addEventListener('activate', () => self.clients.claim());
cleanupOutdatedCaches();

// Filter out problematic Next internals that 404 on Netlify
const manifest = (self.__WB_MANIFEST || []).filter((entry) => {
  const url = typeof entry === 'string' ? entry : entry.url;
  return !/\/_next\/(app-build-manifest|build-manifest|react-loadable-manifest|middleware-manifest|prerender-manifest)\.json$/.test(url);
});

// Ignore all URL params when matching precached entries to avoid version hash mismatches
precacheAndRoute(manifest, { ignoreURLParametersMatching: [/.*/] });
