/* Service worker — Web Push + mise en cache légère pour usage hors ligne du shell */
const STATIC_CACHE = 'gs-shell-v3';
const PRECACHE_URLS = ['/', '/favicon.ico'];
/** Chemins laissés au navigateur (pas d’interception — évite Failed to fetch en dev). */
const BYPASS_SW_PATHS = ['/inscription', '/pre-inscription', '/_next'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api')) return;
  if (BYPASS_SW_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    return;
  }

  event.respondWith(
    fetch(req).catch(() =>
      caches.match(req).then((cached) => cached || caches.match('/'))
    )
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Notification', body: '', url: '/' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    data.body = event.data ? event.data.text() : '';
  }
  const title = data.title || 'Gestion Scolaire';
  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: data.url || '/' },
    tag: `gs-${Date.now()}`,
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  const base =
    self.location.origin && self.location.origin !== 'null'
      ? self.location.origin
      : '';
  const target = url.startsWith('http') ? url : `${base}${url.startsWith('/') ? url : `/${url}`}`;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === target && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target);
      }
    })
  );
});
