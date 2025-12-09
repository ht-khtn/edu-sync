/**
 * PWA (Progressive Web App) Utilities
 * 
 * Helpers for:
 * - Service worker registration and management
 * - Cache strategy configuration
 * - Offline detection
 * - Install prompt handling
 * 
 * Usage:
 * ```tsx
 * import { registerServiceWorker, getCacheStrategy } from '@/lib/pwa-utils'
 * 
 * useEffect(() => {
 *   registerServiceWorker()
 * }, [])
 * ```
 */

/**
 * Cache strategy types
 */
export type CacheStrategy = 'network-first' | 'cache-first' | 'stale-while-revalidate' | 'network-only' | 'cache-only';

/**
 * Cache configuration for different route patterns
 */
export const CACHE_STRATEGY_MAP: Record<string, CacheStrategy> = {
  // API routes: Network first (always fresh data, fallback to cache)
  '/api/': 'network-first',
  '/api/auth/': 'network-only', // Never cache auth
  '/api/session': 'network-first', // Always fresh session
  
  // Static assets: Cache first (never changes after build)
  '/_next/static/': 'cache-first',
  '/static/': 'cache-first',
  
  // HTML pages: Stale while revalidate (serve cached, update in background)
  '.html': 'stale-while-revalidate',
  '/': 'stale-while-revalidate',
  
  // Images: Cache first with long TTL
  '/api/images/': 'cache-first',
  '.jpg': 'cache-first',
  '.png': 'cache-first',
  '.webp': 'cache-first',
  '.avif': 'cache-first',
  
  // Fonts: Cache first forever (immutable)
  '/fonts/': 'cache-first',
};

/**
 * Cache names for different types of content
 */
export const CACHE_NAMES = {
  static: 'static-v1',
  pages: 'pages-v1',
  api: 'api-v1',
  images: 'images-v1',
  fonts: 'fonts-v1',
} as const;

/**
 * Get cache strategy for a given pathname
 * 
 * @param pathname - Request pathname
 * @returns Cache strategy to use
 */
export function getCacheStrategy(pathname: string): CacheStrategy {
  // Check exact matches first
  for (const [pattern, strategy] of Object.entries(CACHE_STRATEGY_MAP)) {
    if (pathname === pattern || pathname.startsWith(pattern)) {
      return strategy;
    }
  }
  
  // Check file extensions
  for (const [pattern, strategy] of Object.entries(CACHE_STRATEGY_MAP)) {
    if (pathname.endsWith(pattern)) {
      return strategy;
    }
  }
  
  // Default: network first
  return 'network-first';
}

/**
 * Get cache name for a given strategy
 * 
 * @param strategy - Cache strategy
 * @returns Cache name
 */
export function getCacheName(strategy: CacheStrategy): string {
  if (strategy === 'cache-first' || strategy === 'cache-only') {
    return CACHE_NAMES.static;
  }
  if (strategy === 'stale-while-revalidate') {
    return CACHE_NAMES.pages;
  }
  return CACHE_NAMES.api;
}

/**
 * Register service worker
 * 
 * Should be called in useEffect of a client component
 * 
 * @example
 * ```tsx
 * useEffect(() => {
 *   registerServiceWorker()
 * }, [])
 * ```
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported');
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none', // Always check for updates
    });
    
    console.log('Service Worker registered:', registration);
    
    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60000); // Check every minute
    
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Unregister service worker
 * 
 * @param pathname - Optional pathname scope
 */
export async function unregisterServiceWorker(pathname: string = '/'): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    for (const registration of registrations) {
      if (registration.scope === pathname || pathname === '/') {
        const success = await registration.unregister();
        console.log('Service Worker unregistered:', success);
        return success;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Service Worker unregistration failed:', error);
    return false;
  }
}

/**
 * Check if offline
 * 
 * @returns true if offline (no internet connection)
 */
export function isOffline(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return !navigator.onLine;
}

/**
 * Listen for online/offline changes
 * 
 * @param callback - Function to call when online status changes
 * @returns Cleanup function to remove listeners
 * 
 * @example
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = listenOfflineStatus((isOffline) => {
 *     console.log('Offline:', isOffline)
 *   })
 *   return unsubscribe
 * }, [])
 * ```
 */
export function listenOfflineStatus(callback: (isOffline: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  
  const handleOnline = () => callback(false);
  const handleOffline = () => callback(true);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Request persistent storage (better cache behavior)
 * 
 * @returns Promise<boolean> true if persistent storage granted
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }
  
  try {
    const result = await navigator.storage.persist();
    console.log('Persistent storage:', result ? 'granted' : 'denied');
    return result;
  } catch (error) {
    console.error('Persistent storage request failed:', error);
    return false;
  }
}

/**
 * Check if persistent storage is granted
 * 
 * @returns Promise<boolean>
 */
export async function isPersistentStorageGranted(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return false;
  }
  
  try {
    return await navigator.storage.persisted();
  } catch (error) {
    console.error('Persistent storage check failed:', error);
    return false;
  }
}

/**
 * Check for service worker updates
 * 
 * Should be called periodically to check for new versions
 * 
 * @returns Promise<boolean> true if update available
 */
export async function checkForServiceWorkerUpdate(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    for (const registration of registrations) {
      await registration.update();
      
      if (registration.waiting) {
        console.log('Service Worker update available');
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Service Worker update check failed:', error);
    return false;
  }
}

/**
 * Skip waiting and activate new service worker
 * 
 * Use this to force activation of a new service worker version
 */
export async function skipWaitingServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    for (const registration of registrations) {
      if (registration.waiting) {
        // Tell the service worker to skip waiting
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Listen for controller change
        let resolver: (value: boolean) => void;
        const promise = new Promise<boolean>(resolve => {
          resolver = resolve;
        });
        
        const unsubscribe = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
        
        const handleControllerChange = () => {
          unsubscribe();
          resolver(true);
        };
        
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          unsubscribe();
          resolver(false);
        }, 5000);
        
        return promise;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Skip waiting failed:', error);
    return false;
  }
}

/**
 * Clear all caches
 * 
 * Warning: This will delete all cached content!
 * 
 * @returns Promise<boolean> true if successful
 */
export async function clearAllCaches(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('All caches cleared');
    return true;
  } catch (error) {
    console.error('Cache clearing failed:', error);
    return false;
  }
}

/**
 * Get cache size estimation
 * 
 * @returns Promise<{usage: number, quota: number}>
 */
export async function estimateCacheSize(): Promise<{ usage: number; quota: number }> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0 };
  }
  
  try {
    const result = await navigator.storage.estimate();
    return {
      usage: result.usage ?? 0,
      quota: result.quota ?? 0,
    };
  } catch (error) {
    console.error('Cache size estimation failed:', error);
    return { usage: 0, quota: 0 };
  }
}

/**
 * PWA installation related utilities
 */
export const PWA_INSTALL = {
  /**
   * Check if app is already installed
   */
  isInstalled(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    
    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    
    // Check if running in PWA window
    return (navigator as unknown as Record<string, unknown>).standalone === true;
  },
  
  /**
   * Prompt user to install app
   * 
   * @param deferredPrompt - The beforeinstallprompt event
   * @returns Promise<boolean> true if user accepted
   */
  async promptInstall(deferredPrompt: Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> }): Promise<boolean> {
    if (!deferredPrompt) {
      return false;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    return outcome === 'accepted';
  },
};

/**
 * Service worker messaging
 * 
 * Send messages to service worker
 */
export function sendMessageToServiceWorker(message: Record<string, unknown>): void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
    console.warn('Service Worker not active');
    return;
  }
  
  navigator.serviceWorker.controller.postMessage(message);
}

/**
 * Listen for messages from service worker
 * 
 * @param callback - Function to call when message received
 * @returns Cleanup function
 */
export function listenForServiceWorkerMessages(
  callback: (event: MessageEvent) => void
): () => void {
  if (typeof navigator === 'undefined') {
    return () => {};
  }
  
  const handleMessage = (event: MessageEvent) => {
    callback(event);
  };
  
  navigator.serviceWorker.addEventListener('message', handleMessage);
  
  return () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
  };
}
