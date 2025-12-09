/**
 * Dynamic Import Utilities
 *
 * Helpers for lazy-loading heavy components with Next.js dynamic()
 * Provides consistent skeleton/loading state patterns
 */

import dynamic from 'next/dynamic';
import React from 'react';

/**
 * Skeleton loader component - placeholder while component loads
 * Prevents layout shift (CLS) by matching component dimensions
 */
export function ChartSkeleton() {
  return (
    <div className="w-full h-64 bg-muted rounded-lg animate-pulse flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading chart...</p>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="w-full bg-muted rounded-lg p-6 animate-pulse space-y-4">
      <div className="h-6 bg-muted-foreground/20 rounded w-1/3"></div>
      <div className="h-4 bg-muted-foreground/20 rounded w-full"></div>
      <div className="h-4 bg-muted-foreground/20 rounded w-5/6"></div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="w-full bg-muted rounded-lg p-6 animate-pulse space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-10 bg-muted-foreground/20 rounded w-full"></div>
      ))}
    </div>
  );
}

/**
 * Create a dynamic component with sensible defaults
 * 
 * @param importFn - Dynamic import function
 * @param loadingComponent - Component to show while loading
 * @param options - Additional dynamic() options
 * 
 * @example
 * ```tsx
 * const DynamicChart = createDynamicComponent(
 *   () => import('./MyChart'),
 *   <ChartSkeleton />
 * );
 * ```
 */
export function createDynamicComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  loadingComponent: React.ReactNode = <ChartSkeleton />,
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
export async function preloadComponent(
  importFn: () => Promise<{ default: React.ComponentType<any> }>
) {
  try {
    await importFn();
  } catch (error) {
    console.warn('Failed to preload component:', error);
  }
}

/**
 * Check if a component should be lazy-loaded based on viewport
 * Useful for below-the-fold content
 */
export function useShouldLoadComponent(ref: React.RefObject<HTMLDivElement>) {
  const [shouldLoad, setShouldLoad] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '100px' } // Start loading 100px before entering viewport
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref]);

  return shouldLoad;
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
export function getConditionalComponent<T extends React.ComponentType<any>>(
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
  T extends Record<string, () => Promise<{ default: React.ComponentType<any> }>>
>(
  components: T,
  loadingComponent?: React.ReactNode
): {
  [K in keyof T]: React.ComponentType<any>;
} {
  return Object.fromEntries(
    Object.entries(components).map(([key, importFn]) => [
      key,
      createDynamicComponent(
        importFn as () => Promise<{ default: React.ComponentType<any> }>,
        loadingComponent
      )
    ])
  ) as any;
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
