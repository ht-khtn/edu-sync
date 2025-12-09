/**
 * Link Prefetch Optimizer
 *
 * Determines optimal prefetch strategy for Next.js Links based on route type:
 * - Static routes (cached 1h): Always prefetch (true)
 * - Semi-static routes (ISR 30-60s): Prefetch on intent/hover
 * - Dynamic/real-time routes: Don't prefetch (false)
 */

type PrefetchStrategy = boolean | 'intent';

interface PrefetchConfig {
  route: string;
  prefetch: PrefetchStrategy;
  priority?: boolean;
  description?: string;
}

/**
 * Static routes - cached at Edge for 1 hour
 * Safe to always prefetch since content changes rarely
 */
const STATIC_ROUTES = [
  '/admin/accounts',
  '/admin/classes',
  '/admin/roles',
];

/**
 * Semi-static routes - ISR with 30-60s revalidation
 * Prefetch on user intent (hover) to reduce bandwidth
 */
const SEMI_STATIC_ROUTES = [
  '/admin/violation-entry',
  '/admin/violation-history',
  '/admin/violation-stats',
  '/admin/leaderboard',
  '/admin/criteria',
  '/olympia/client',
  '/olympia/admin/accounts',
  '/olympia/admin/matches',
  '/client/announcements',
  '/client/events',
  '/client/leaderboard',
  '/client/my-violations',
  '/client/profile',
];

/**
 * Dynamic routes - fetch on demand only
 * Real-time data or auth-dependent, should NOT prefetch
 */
const DYNAMIC_ROUTES = [
  '/olympia/game/',        // Real-time game state
  '/olympia/watch/',       // Real-time match watching
  '/olympia/admin/matches/',  // Has dynamic [matchId]
];

/**
 * Get optimal prefetch strategy for a given href
 *
 * @param href - Route href/path
 * @returns PrefetchConfig with prefetch strategy
 *
 * @example
 * ```tsx
 * const { prefetch } = getPrefetchConfig('/admin/accounts');
 * // Returns: { route: '/admin/accounts', prefetch: true, priority: true }
 *
 * const { prefetch } = getPrefetchConfig('/admin/violation-entry');
 * // Returns: { route: '/admin/violation-entry', prefetch: 'intent' }
 *
 * const { prefetch } = getPrefetchConfig('/olympia/game/abc123');
 * // Returns: { route: '/olympia/game/abc123', prefetch: false }
 * ```
 */
export function getPrefetchConfig(href: string): PrefetchConfig {
  // Normalize href (remove trailing slash, query params)
  const normalizedHref = href.split('?')[0].replace(/\/$/, '');

  // Check static routes
  if (STATIC_ROUTES.some(route => normalizedHref === route)) {
    return {
      route: normalizedHref,
      prefetch: true,
      priority: true,
      description: 'Static route - always prefetch'
    };
  }

  // Check semi-static routes
  if (SEMI_STATIC_ROUTES.some(route => normalizedHref.startsWith(route))) {
    return {
      route: normalizedHref,
      prefetch: 'intent',
      description: 'Semi-static route - prefetch on hover'
    };
  }

  // Check dynamic routes
  if (DYNAMIC_ROUTES.some(route => normalizedHref.startsWith(route))) {
    return {
      route: normalizedHref,
      prefetch: false,
      description: 'Dynamic/real-time route - no prefetch'
    };
  }

  // Default: don't prefetch unknown routes
  return {
    route: normalizedHref,
    prefetch: false,
    description: 'Unknown route - no prefetch (default)'
  };
}

/**
 * Check if a route is static (safe to always prefetch)
 */
export function isStaticRoute(href: string): boolean {
  const normalizedHref = href.split('?')[0].replace(/\/$/, '');
  return STATIC_ROUTES.some(route => normalizedHref === route);
}

/**
 * Check if a route is semi-static (should prefetch on intent)
 */
export function isSemiStaticRoute(href: string): boolean {
  const normalizedHref = href.split('?')[0].replace(/\/$/, '');
  return SEMI_STATIC_ROUTES.some(route => normalizedHref.startsWith(route));
}

/**
 * Check if a route is dynamic (should NOT prefetch)
 */
export function isDynamicRoute(href: string): boolean {
  const normalizedHref = href.split('?')[0].replace(/\/$/, '');
  return DYNAMIC_ROUTES.some(route => normalizedHref.startsWith(route));
}

/**
 * Get readable description of a route's caching strategy
 */
export function getRouteDescription(href: string): string {
  const config = getPrefetchConfig(href);
  return config.description || 'Unknown route';
}

/**
 * Batch check multiple routes at once
 */
export function getPrefetchConfigBatch(
  hrefs: string[]
): Record<string, PrefetchConfig> {
  return Object.fromEntries(
    hrefs.map(href => [href, getPrefetchConfig(href)])
  );
}
