'use client';

import { useEffect, useState } from 'react';
import {
  registerServiceWorker,
  listenOfflineStatus,
  checkForServiceWorkerUpdate,
  skipWaitingServiceWorker,
  requestPersistentStorage,
  CACHE_NAMES,
} from '@/lib/pwa-utils';
import PrecacheOverlay from './PrecacheOverlay';

/**
 * Service Worker Registration Component
 * 
 * Handles:
 * - Service worker registration
 * - Aggressive full-app precaching (pages + images)
 * - Update detection and prompt
 * - Persistent storage request
 * - Offline status monitoring
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    let updateAvailable = false;

    // Register service worker
    registerServiceWorker()
      .then((registration) => {
        if (registration) {
          // Aggressive full precache immediately after SW ready
          // Send all pages + common image patterns to cache
          const allPagesToCache = [
            '/admin',
            '/admin/violation-entry',
            '/admin/violation-history',
            '/admin/violation-stats',
            '/admin/leaderboard',
            '/admin/criteria',
            '/admin/accounts',
            '/admin/roles',
            '/admin/classes',
            '/client',
            '/client/violations',
            '/client/leaderboard',
            '/offline',
          ];

          const imagePatterns = [
            '/globe.svg',
            '/file.svg',
            '/window.svg',
          ];

          const urlsToCache = [...allPagesToCache, ...imagePatterns];

          // Split into smaller chunks to avoid blocking
          const chunkSize = 5;
          let chunkIndex = 0;

          const sendChunk = () => {
            if (chunkIndex * chunkSize >= urlsToCache.length) {
              console.log('[SW] Full precache completed');
              return;
            }

            const chunk = urlsToCache.slice(
              chunkIndex * chunkSize,
              (chunkIndex + 1) * chunkSize
            );

            // Send message to SW to cache this chunk
            registration.active?.postMessage({
              type: 'CACHE_URLS',
              payload: {
                cacheName: CACHE_NAMES.pages,
                urls: chunk,
              },
            });

            console.log(`[SW] Sent chunk ${chunkIndex + 1}/${Math.ceil(urlsToCache.length / chunkSize)}`);
            chunkIndex++;

            // Send next chunk after 100ms (non-blocking)
            setTimeout(sendChunk, 100);
          };

          // Start precaching immediately (after paint)
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
              setTimeout(sendChunk, 50);
            });
          } else {
            setTimeout(sendChunk, 100);
          }
        }
      })
      .catch((error) => {
        console.error('Failed to register service worker:', error);
      });

    // Request persistent storage for better cache behavior
    requestPersistentStorage().catch((error) => {
      console.error('Failed to request persistent storage:', error);
    });

    // Listen for offline status changes
    const unsubscribe = listenOfflineStatus(() => {
      // Offline status is handled by OfflineIndicator component
    });

    // Check for updates periodically (every 30 seconds)
    const updateCheckInterval = setInterval(() => {
      checkForServiceWorkerUpdate().then((hasUpdate) => {
        if (hasUpdate && !updateAvailable) {
          updateAvailable = true;
          console.log('Service worker update available');
          
          // Auto-reload to apply update after 5 seconds
          const timer = setTimeout(() => {
            skipWaitingServiceWorker().then((success) => {
              if (success) {
                // Reload page to apply new service worker
                window.location.reload();
              }
            });
          }, 5000);
          
          return () => clearTimeout(timer);
        }
      });
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(updateCheckInterval);
    };
  }, []);

  // Precache progress state and message listener
  const [precacheVisible, setPrecacheVisible] = useState(false);
  const [precacheDone, setPrecacheDone] = useState(0);
  const [precacheTotal, setPrecacheTotal] = useState(0);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data || {};
      if (msg.type === 'PRECACHE_PROGRESS') {
        const { done, total } = msg.payload || {};
        setPrecacheTotal(total ?? 0);
        setPrecacheDone(done ?? 0);
        setPrecacheVisible(true);
      }

      if (msg.type === 'PRECACHE_COMPLETE') {
        setPrecacheDone((msg.payload && msg.payload.total) || 0);
        setPrecacheVisible(false);
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, []);

  // Listen for beforeinstallprompt to show install button
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      // Prevent the mini-infobar from appearing
      event.preventDefault();
      // Store the event for later use
      (window as unknown as Record<string, unknown>).deferredPrompt = event;
      // Show install prompt UI
      const installPrompt = document.getElementById('install-prompt');
      if (installPrompt) {
        installPrompt.style.display = 'block';
      }
    };

    const handleAppInstalled = () => {
      // Hide install prompt
      const installPrompt = document.getElementById('install-prompt');
      if (installPrompt) {
        installPrompt.style.display = 'none';
      }
      console.log('App was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return (
    <>
      <PrecacheOverlay
        visible={precacheVisible}
        done={precacheDone}
        total={precacheTotal}
        onSkip={() => setPrecacheVisible(false)}
      />
      {/* Install Prompt - shown when beforeinstallprompt fires */}
      <div
        id="install-prompt"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          zIndex: 999,
          padding: '1rem',
          backgroundColor: '#000',
          color: '#fff',
          borderRadius: '0.5rem',
          maxWidth: '300px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 600 }}>Install EduSync</div>
          <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', opacity: 0.8 }}>
            Add EduSync to your home screen for quick access
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => {
              const prompt = (window as unknown as Record<string, unknown>).deferredPrompt as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | undefined;
              if (prompt) {
                prompt.prompt();
                prompt.userChoice.then((choiceResult: { outcome: string }) => {
                  if (choiceResult.outcome === 'accepted') {
                    console.log('App installed');
                  }
                  (window as unknown as Record<string, unknown>).deferredPrompt = null;
                  const installPrompt = document.getElementById('install-prompt');
                  if (installPrompt) {
                    installPrompt.style.display = 'none';
                  }
                });
              }
            }}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '0.25rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Install
          </button>
          <button
            onClick={() => {
              const installPrompt = document.getElementById('install-prompt');
              if (installPrompt) {
                installPrompt.style.display = 'none';
              }
            }}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              color: '#fff',
              border: '1px solid #fff',
              borderRadius: '0.25rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Later
          </button>
        </div>
      </div>
    </>
  );
}
