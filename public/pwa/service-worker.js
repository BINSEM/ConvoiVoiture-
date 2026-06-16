// Service Worker pour le raccourci PWA "État des Lieux" (EDL)
// Ce Service Worker assure l'éligibilité aux critères d'installation de Chrome sur Android et gère l'état hors-ligne.

const CACHE_NAME = 'edl-pwa-cache-v1';
const ASSETS_TO_CACHE = [
  '/pwa/index.html',
  '/pwa/styles.css',
  '/pwa/app.js',
  '/pwa/manifest.webmanifest',
  '/pwa/icon-512.png'
];

// Phase d'installation : mise en cache des fichiers essentiels
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Mise en cache des ressources PWA...', ASSETS_TO_CACHE);
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Phase d'activation : nettoyage des vieux caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Nettoyage de l\'ancien cache :', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes réseau : stratégie Offline Fallback (Network first, fall back to cache)
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non GET ou d'autres domaines si besoin
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .catch(() => {
        console.log('[Service Worker] Échec du réseau. Tentative de récupération depuis le cache :', event.request.url);
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si le fichier principal n'est pas trouvé et que c'est une navigation, renvoyer l'index PWA mis en cache
          if (event.request.mode === 'navigate') {
            return caches.match('/pwa/index.html');
          }
        });
      })
  );
});
