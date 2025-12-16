/**
 * Service Worker for EduSync
 * 
 * Handles:
 * - Offline functionality
 * - Cache strategies (network-first, cache-first, SWR)
 * - Background sync
 * - Push notifications
 * 
 * Install: Copy to public/service-worker.js
 */

// APP_VERSION được inject khi build (xem scripts/inject-version.cjs)
const APP_VERSION = '0.1.1-cbfb7c0';
const CACHE_NAMES = {
  static: `static-${APP_VERSION}`,
  pages: `pages-${APP_VERSION}`,
  api: `api-${APP_VERSION}`,
  images: `images-${APP_VERSION}`,
  fonts: `fonts-${APP_VERSION}`,
};

function isHttpRequest(request) {
  try {
    const url = typeof request === 'string' ? new URL(request) : new URL(request.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Keep pre-cache minimal to avoid heavy first-load work; pages are cached on-demand
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.webmanifest',
];

async function notifyCachePrimed() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => {
    client.postMessage({ type: 'CACHE_PRIMED', version: APP_VERSION });
  });
}

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Fallback timeout to avoid blocking if cache fails
      const timeout = new Promise((resolve) => setTimeout(resolve, 6000));

      const cacheJob = caches.open(CACHE_NAMES.static).then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn('Failed to cache some static assets:', err);
        });
      });

      await Promise.race([Promise.allSettled([cacheJob, timeout]), timeout]);
      await notifyCachePrimed();
    })()
  );
  
  // Skip waiting to activate immediately
  self.skipWaiting?.();
});

/**
 * Activate event - cleanup old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => {
        if (!Object.values(CACHE_NAMES).includes(cacheName)) {
          return caches.delete(cacheName);
        }
      })
    );

    // Take control of clients immediately
    await self.clients.claim?.();

    // Notify clients about new SW version
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => {
      client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION });
    });
  })());
});

/**
 * Determine cache strategy based on URL
 */
function getCacheStrategy(url) {
  const pathname = new URL(url).pathname;
  
  // Cache session API for faster load (but revalidate on every request)
  if (pathname.includes('/session')) {
    return 'stale-while-revalidate';
  }
  
  // Never cache auth (login/logout must always hit server)
  if (pathname.includes('/auth/')) {
    return 'network-only';
  }
  
  // All other API: cache with network first (fallback to cache when offline)
  if (pathname.startsWith('/api/')) {
    return 'cache-first-fallback';
  }
  
  // Static assets: cache first
  if (pathname.startsWith('/_next/static/') || pathname.startsWith('/static/')) {
    return 'cache-first';
  }
  
  // Images: cache first
  if (/\.(jpg|png|webp|avif|gif)$/i.test(pathname)) {
    return 'cache-first';
  }
  
  // Fonts: cache first
  if (pathname.startsWith('/fonts/') || /\.(ttf|woff|woff2)$/i.test(pathname)) {
    return 'cache-first';
  }
  
  // All pages: cache first with network fallback for full offline support
  return 'cache-first-fallback';
}

/**
 * Get cache name for strategy
 */
function getCacheName(strategy) {
  switch (strategy) {
    case 'cache-first':
    case 'cache-first-fallback':
      return CACHE_NAMES.static;
    case 'stale-while-revalidate':
      return CACHE_NAMES.pages;
    case 'network-first':
      return CACHE_NAMES.api;
    default:
      return CACHE_NAMES.pages;
  }
}

/**
 * Cache first with network fallback strategy
 * Try cache first, if miss then fetch from network and cache
 * Perfect for offline-first apps
 */
async function cacheFirstFallback(request) {
  if (!isHttpRequest(request)) return fetch(request);
  // Skip caching for non-GET requests
  if (request.method !== 'GET') return fetch(request);
  const cacheName = getCacheName('cache-first-fallback');
  
  // Try cache first
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background without blocking
    fetch(request).then((response) => {
      if (response && response.ok && !response.bodyUsed && response.type === 'basic') {
        caches.open(cacheName).then((cache) => {
          cache.put(request, response.clone());
        });
      }
    }).catch(() => {
      // Network failed, but we have cache so it's OK
    });
    
    return cached;
  }
  
  // Cache miss - fetch from network
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.ok && !response.bodyUsed && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch {
    // Network failed and no cache
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlineResponse = await caches.match('/offline');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Network first strategy
 * Try network, fallback to cache, fallback to offline page
 */
async function networkFirst(request) {
  if (!isHttpRequest(request)) return fetch(request);
  // Skip caching for non-GET requests
  if (request.method !== 'GET') return fetch(request);
  const cacheName = getCacheName('network-first');
  
  try {
    // Try to fetch from network
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.ok && !response.bodyUsed && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch {
    // Network failed, try cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Cache miss, return offline page for HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlineResponse = await caches.match('/offline');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    // Return error response
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Cache first strategy
 * Try cache, fallback to network
 */
async function cacheFirst(request) {
  if (!isHttpRequest(request)) return fetch(request);
  // Skip caching for non-GET requests
  if (request.method !== 'GET') return fetch(request);
  const cacheName = getCacheName('cache-first');
  
  // Try cache first
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    // Cache miss, fetch from network
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.ok && !response.bodyUsed && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch {
    // Network failed and no cache
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Stale while revalidate strategy
 * Return cached immediately, update in background
 */
async function staleWhileRevalidate(request) {
  if (!isHttpRequest(request)) return fetch(request);
  // Skip caching for non-GET requests
  if (request.method !== 'GET') return fetch(request);
  const cacheName = getCacheName('stale-while-revalidate');
  
  // Check cache first
  const cached = await caches.match(request);
  
  // Always fetch in background to update cache
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.ok && !response.bodyUsed && response.type === 'basic') {
      caches.open(cacheName).then((c) => {
        // Clone before body is consumed
        try {
          c.put(request, response.clone());
        } catch {
          // Ignore clone errors
        }
      });
    }
    return response;
  }).catch((err) => {
    // Return cached on network error
    return cached || Promise.reject(err);
  });
  
  // Return cached if available, otherwise wait for network
  return cached || fetchPromise;
}

/**
 * Network only strategy
 * Never cache, always fetch from network
 */
async function networkOnly(request) {
  if (!isHttpRequest(request)) return fetch(request);
  try {
    return await fetch(request);
  } catch {
    // Network failed
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlineResponse = await caches.match('/offline');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Fetch event - apply cache strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!isHttpRequest(request)) {
    return; // skip non-http(s) like chrome-extension
  }

  // If this is a navigation (user visiting /), prefer network-first so
  // redirects and Set-Cookie from the server are applied (important after login).
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  const strategy = getCacheStrategy(request.url);

  // Handle based on strategy
  if (strategy === 'network-first') {
    event.respondWith(networkFirst(request));
  } else if (strategy === 'cache-first') {
    event.respondWith(cacheFirst(request));
  } else if (strategy === 'cache-first-fallback') {
    event.respondWith(cacheFirstFallback(request));
  } else if (strategy === 'stale-while-revalidate') {
    event.respondWith(staleWhileRevalidate(request));
  } else if (strategy === 'network-only') {
    event.respondWith(networkOnly(request));
  }
});

/**
 * Message event - handle messages from clients
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      // Skip waiting and activate immediately
      self.skipWaiting?.();
      break;
      
    case 'CLEAR_CACHE':
      // Clear specific cache
      event.waitUntil(
        caches.delete(payload.cacheName).then(() => {
          event.ports[0]?.postMessage({ type: 'CACHE_CLEARED' });
        })
      );
      break;
      
    case 'CACHE_URLS':
      // Cache URLs individually and report progress to clients
      event.waitUntil(
        (async () => {
          try {
            const cache = await caches.open(payload.cacheName);
            const total = Array.isArray(payload.urls) ? payload.urls.length : 0;
            let done = 0;

            for (const url of payload.urls || []) {
              try {
                const response = await fetch(url);
                if (response && (response.ok || response.status === 0)) {
                  await cache.put(url, response.clone());
                }
              } catch (err) {
                console.warn(`[SW] Failed to cache ${url}:`, err);
              } finally {
                done++;
                // Broadcast progress to all clients
                const clients = await self.clients.matchAll({ type: 'window' });
                clients.forEach((client) => {
                  client.postMessage({
                    type: 'PRECACHE_PROGRESS',
                    payload: { cacheName: payload.cacheName, done, total },
                  });
                });
              }
            }

            // All done
            const allClients = await self.clients.matchAll({ type: 'window' });
            allClients.forEach((client) => {
              client.postMessage({
                type: 'PRECACHE_COMPLETE',
                payload: { cacheName: payload.cacheName, total },
              });
            });

            console.log(`[SW] Cached ${done}/${total} URLs in ${payload.cacheName}`);
            event.ports[0]?.postMessage({ type: 'URLS_CACHED' });
          } catch (err) {
            console.error(`[SW] Failed to open cache ${payload.cacheName}:`, err);
          }
        })()
      );
      break;
  }
});

/**
 * Push event - handle push notifications
 */
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'EduSync Notification',
    body: 'You have a new message',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  };
  
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch {
      notificationData.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: 'edusync-notification',
      requireInteraction: false,
    })
  );
});

/**
 * Notification click event - navigate to URL
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Find existing window
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

/**
 * Sync event - background sync for offline actions
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-violations') {
    event.waitUntil(
      // Sync violations when back online
      fetch('/api/violations/sync', { method: 'POST' })
        .then(() => {
          // Notify client of successful sync
          self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'SYNC_COMPLETE',
                tag: 'sync-violations',
              });
            });
          });
        })
        .catch(() => {
          // Retry sync
          event.waitUntil(new Promise((resolve) => setTimeout(resolve, 5000)));
        })
    );
  }
});

console.log('Service Worker loaded');
