/**
 * Dynamic Import Utilities
 *
 * Helpers for lazy-loading heavy components with Next.js dynamic()
 * Provides consistent skeleton/loading state patterns
 */

'use client';

import dynamic from 'next/dynamic';
import React from 'react';

/**
 * Create a dynamic component with sensible defaults
 * 
 * @param importFn - Dynamic import function
 * @param loadingComponent - Component to show while loading
 * @param options - Additional dynamic() options
 * 
 * @example
 * ```tsx
 * import { ChartSkeleton } from '@/components/common/Skeletons';
 * const DynamicChart = createDynamicComponent(
 *   () => import('./MyChart'),
 *   <ChartSkeleton />
 * );
 * ```
 */
export function createDynamicComponent<T extends React.ComponentType<Record<string, unknown>>>(
  importFn: () => Promise<{ default: T }>,
  loadingComponent: React.ReactNode,
  options?: Parameters<typeof dynamic>[1]
) {
  return dynamic(importFn, {
    loading: () => loadingComponent as React.ReactElement,
    ssr: true, // Keep SSR enabled for SEO & performance
    ...options
  });
}

/**
 * Preload a dynamic component (start loading before render)
 * Useful for components you know will be needed soon
 * 
 * @example
 * ```tsx
 * useEffect(() => {
 *   // Preload chart component when page loads
 *   preloadComponent(() => import('./Charts'));
 * }, []);
 * ```
 */
export function preloadComponent(
  importFn: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>
) {
  // Trigger the import in the background
  importFn().catch((error) => {
    console.warn('Failed to preload component:', error);
  });
}

/**
 * Hook for viewport-based lazy loading using IntersectionObserver
 * Only load component when it scrolls into view
 * 
 * @param ref - React ref to the container element
 * @returns boolean - true when element is visible in viewport
 * 
 * @example
 * ```tsx
 * const ref = useRef(null);
 * const isVisible = useShouldLoadComponent(ref);
 * 
 * return (
 *   <div ref={ref}>
 *     {isVisible && <DynamicChart />}
 *   </div>
 * );
 * ```
 */
export function useShouldLoadComponent(
  ref: React.RefObject<HTMLElement>,
  options?: IntersectionObserverInit
): boolean {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        // Stop observing after visible
        observer.unobserve(entry.target);
      }
    }, {
      rootMargin: '50px', // Start loading 50px before entering viewport
      ...options
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, options]);

  return isVisible;
}

/**
 * Conditional lazy-load based on client-side condition
 * Returns static or dynamic version based on condition
 * 
 * @example
 * ```tsx
 * const Component = getConditionalComponent(
 *   prefersReducedMotion,
 *   () => import('./StaticVersion'),
 *   () => import('./AnimatedVersion')
 * );
 * ```
 */
export function getConditionalComponent<T extends React.ComponentType<Record<string, unknown>>>(
  condition: boolean,
  trueFn: () => Promise<{ default: T }>,
  falseFn: () => Promise<{ default: T }>
) {
  return dynamic(condition ? trueFn : falseFn, {
    ssr: true
  });
}

/**
 * Batch create multiple dynamic components
 * Reduces boilerplate when you have many lazy-loaded components
 */
export function createDynamicComponents<
  T extends Record<string, () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>>
>(
  components: T,
  loadingComponent?: React.ReactNode
): {
  [K in keyof T]: React.ComponentType<Record<string, unknown>>;
} {
  return Object.fromEntries(
    Object.entries(components).map(([key, importFn]) => [
      key,
      createDynamicComponent(
        importFn as () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
        loadingComponent
      )
    ])
  ) as Record<keyof T, React.ComponentType<Record<string, unknown>>>;
}

/**
 * Get recommended bundle size thresholds
 * For alerting when a component is getting too large
 */
export const BUNDLE_SIZE_THRESHOLDS = {
  chart: 150_000,        // 150KB - recharts is ~122KB
  animation: 100_000,    // 100KB - framer-motion is ~64KB
  editor: 300_000,       // 300KB - rich text editors
  default: 50_000,       // 50KB - default max for most components
} as const;
