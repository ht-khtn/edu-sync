'use client';

import { useEffect } from 'react';
import {
  registerServiceWorker,
  listenOfflineStatus,
  checkForServiceWorkerUpdate,
  skipWaitingServiceWorker,
  requestPersistentStorage,
  CACHE_NAMES,
} from '@/lib/pwa-utils';

/**
 * Service Worker Registration Component
 * 
 * Handles:
 * - Service worker registration
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
          // Precache ALL admin and client pages for full offline support
          const allPages = [
            '/admin',
            '/admin/leaderboard', 
            '/admin/violation-history',
            '/admin/violation-entry',
            '/admin/violation-stats',
            '/admin/accounts',
            '/admin/criteria',
            '/admin/roles',
            '/admin/classes',
            '/admin/olympia-accounts',
            '/olympia/admin',
            '/olympia/admin/matches',
            '/olympia/admin/rooms',
            '/olympia/admin/question-bank',
            '/olympia/admin/accounts',
            '/client',
          ];
          
          // Send message to service worker to cache these pages
          registration.active?.postMessage({
            type: 'CACHE_URLS',
            payload: {
              cacheName: CACHE_NAMES.pages,
              urls: allPages,
            },
          });
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
