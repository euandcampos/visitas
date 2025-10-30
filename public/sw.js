const CACHE_NAME = 'visitas-v11';
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/state.js',
  '/js/forms.js',
  '/js/location.js',
  '/js/menu.js',
  '/js/uploads.js',
  '/js/permissions.js',
  '/js/apiClient.js',
  '/js/offlineQueue.js',
  '/manifest.json',
  '/icons/entregador-192x192.png',
  '/icons/entregador-512x512.png',
  '/icons/entregador-144x144.png',
  '/icons/entregador-96x96.png',
  '/icons/entregador-72x72.png',
  '/icons/entregador-48x48.png',
  '/icons/entregador-192x192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE).catch((err) => {
        console.error('[SW] Erro ao cachear arquivos estáticos:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests para API (sempre vai para rede)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Cache-first para assets estáticos
  if (STATIC_CACHE.some((path) => url.pathname === path || url.pathname.startsWith('/icons/'))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request);
      })
    );
    return;
  }

  // Network-first para tudo mais
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response('Offline', { status: 503 });
        });
      })
  );
});

