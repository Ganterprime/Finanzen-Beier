// Service Worker: zeigt Push-Nachrichten an, öffnet die App beim Antippen und
// merkt sich App und zuletzt geladene Daten, damit alles auch offline sichtbar ist.
const APP_CACHE = 'app-v1';
const DATA_CACHE = 'daten-v1';

// Alle App-Dateien vorab laden (Liste entsteht beim Build) und alte Stände wegräumen.
async function precache() {
  const cache = await caches.open(APP_CACHE);
  let files = [];
  try {
    files = await (await fetch('/precache.json', { cache: 'no-store' })).json();
  } catch {
    // Ohne Liste werden Dateien beim ersten Öffnen nach und nach gespeichert.
  }
  const keep = new Set(['/', '/manifest.json', '/icon-192.png', ...files]);
  await cache.addAll([...keep]);
  for (const request of await cache.keys()) {
    if (!keep.has(new URL(request.url).pathname)) await cache.delete(request);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Erst aus dem Netz holen und den Stand speichern. Ohne Netz den gespeicherten Stand liefern.
async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached =
      (await cache.match(request, { ignoreVary: true })) ||
      (fallbackUrl && (await cache.match(fallbackUrl, { ignoreVary: true })));
    if (cached) return cached;
    throw err;
  }
}

// Dateien mit Prüfsumme im Namen ändern sich nie: einmal laden, dann aus dem Speicher.
async function cacheFirst(request) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') event.respondWith(networkFirst(request, APP_CACHE, '/'));
    else if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/'))
      event.respondWith(cacheFirst(request));
    else if (url.pathname !== '/sw.js') event.respondWith(networkFirst(request, APP_CACHE));
  } else if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'clear-data') event.waitUntil(caches.delete(DATA_CACHE));
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Finanzen Beier', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Finanzen Beier', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
