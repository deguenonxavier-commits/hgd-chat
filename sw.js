/* ═══════════════════════════════════════════════
   HGD Messenger — Service Worker v5.1
   Gère le cache offline + installation PWA
═══════════════════════════════════════════════ */

const CACHE_NAME = 'hgd-v5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js'
];

/* ── Installation ── */
self.addEventListener('install', event => {
  console.log('[SW HGD] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // On met en cache ce qu'on peut, sans bloquer si un asset échoue
        return Promise.allSettled(
          STATIC_ASSETS.map(url => cache.add(url).catch(() => null))
        );
      })
      .then(() => {
        console.log('[SW HGD] Cache prêt');
        return self.skipWaiting();
      })
  );
});

/* ── Activation & nettoyage vieux caches ── */
self.addEventListener('activate', event => {
  console.log('[SW HGD] Activation');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Stratégie fetch : Network-first pour Firebase, Cache-first pour assets ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // On ne touche pas aux appels Firebase / Firestore / Auth → toujours réseau
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('firebase.google.com') ||
    url.hostname.includes('firebasestorage.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return; // laisse le navigateur gérer
  }

  // Pour les requêtes GET : Network-first avec fallback cache
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si OK, on met à jour le cache
          if (response && response.status === 200 && response.type !== 'opaque') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Réseau indispo → on sert depuis le cache
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            // Si c'est une navigation, on renvoie index.html
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Hors ligne', { status: 503 });
          });
        })
    );
  }
});

/* ── Push notifications (optionnel, futur) ── */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'HGD', {
    body: data.body || 'Nouveau message',
    icon: './manifest.json',
    badge: './manifest.json',
    data: data
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('./')
  );
});
