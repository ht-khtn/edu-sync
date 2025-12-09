/**
 * Cache Headers Utilities
 * 
 * Provides consistent cache headers for different types of responses
 * Optimized for Vercel Edge Network
 */

export type CacheStrategy = 
  | 'no-cache'        // Never cache (auth, user-specific)
  | 'private'         // Browser cache only, no CDN
  | 'public-short'    // CDN + browser, 1min
  | 'public-medium'   // CDN + browser, 5min
  | 'public-long'     // CDN + browser, 1hr
  | 'static'          // CDN + browser, 1 year (immutable assets)
  | 'swr-short'       // Stale-while-revalidate, 1min stale
  | 'swr-medium'      // Stale-while-revalidate, 5min stale
  | 'swr-long';       // Stale-while-revalidate, 1hr stale

/**
 * Get Cache-Control header value for a given strategy
 * 
 * @example
 * ```ts
 * const headers = { 'Cache-Control': getCacheHeader('public-short') };
 * return NextResponse.json(data, { headers });
 * ```
 */
export function getCacheHeader(strategy: CacheStrategy): string {
  switch (strategy) {
    case 'no-cache':
      // Never cache, always fetch fresh
      // Use for: auth endpoints, user sessions, real-time data
      return 'no-store, no-cache, must-revalidate, proxy-revalidate';

    case 'private':
      // Browser cache only (not CDN)
      // Use for: user-specific data that can be cached locally
      return 'private, max-age=60, must-revalidate';

    case 'public-short':
      // Cache at CDN + browser for 1 minute
      // Use for: frequently updated data (leaderboard, stats)
      return 'public, max-age=60, s-maxage=60, stale-while-revalidate=30';

    case 'public-medium':
      // Cache at CDN + browser for 5 minutes
      // Use for: semi-static data (class lists, criteria)
      return 'public, max-age=300, s-maxage=300, stale-while-revalidate=60';

    case 'public-long':
      // Cache at CDN + browser for 1 hour
      // Use for: static reference data (roles, settings)
      return 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=300';

    case 'static':
      // Cache forever (1 year) - for immutable assets
      // Use for: hashed assets, images with version in filename
      return 'public, max-age=31536000, immutable';

    case 'swr-short':
      // Stale-while-revalidate: serve stale for 1min, revalidate in background
      // Use for: real-time dashboards, live data
      return 'public, max-age=30, s-maxage=30, stale-while-revalidate=60';

    case 'swr-medium':
      // Stale-while-revalidate: serve stale for 5min, revalidate in background
      // Use for: analytics, reports
      return 'public, max-age=120, s-maxage=120, stale-while-revalidate=300';

    case 'swr-long':
      // Stale-while-revalidate: serve stale for 1hr, revalidate in background
      // Use for: historical data, archives
      return 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600';

    default:
      return 'no-store';
  }
}

/**
 * Create response headers with cache control
 * 
 * @example
 * ```ts
 * return NextResponse.json(data, { 
 *   headers: createCacheHeaders('public-short') 
 * });
 * ```
 */
export function createCacheHeaders(
  strategy: CacheStrategy,
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  return {
    'Cache-Control': getCacheHeader(strategy),
    ...additionalHeaders,
  };
}

/**
 * Determine cache strategy based on route path
 * 
 * @example
 * ```ts
 * const strategy = getCacheStrategyForRoute('/api/accounts');
 * // Returns 'public-long'
 * ```
 */
export function getCacheStrategyForRoute(pathname: string): CacheStrategy {
  // Auth routes - never cache
  if (pathname.includes('/api/auth') || pathname.includes('/api/session')) {
    return 'no-cache';
  }

  // User-specific routes - private cache only
  if (pathname.includes('/my-violations') || pathname.includes('/profile')) {
    return 'private';
  }

  // Reference data - long cache
  if (
    pathname.includes('/api/accounts') ||
    pathname.includes('/api/classes') ||
    pathname.includes('/api/roles') ||
    pathname.includes('/api/criteria')
  ) {
    return 'public-long';
  }

  // Stats & reports - medium cache with SWR
  if (
    pathname.includes('/violation-stats') ||
    pathname.includes('/leaderboard')
  ) {
    return 'swr-medium';
  }

  // Recent/live data - short cache with SWR
  if (
    pathname.includes('/violation-entry') ||
    pathname.includes('/olympia/game')
  ) {
    return 'swr-short';
  }

  // Batch operations - no cache (mutations)
  if (pathname.includes('/batch') || pathname.includes('/record-ops')) {
    return 'no-cache';
  }

  // Default: short public cache
  return 'public-short';
}

/**
 * Cache configuration recommendations by page type
 */
export const CACHE_RECOMMENDATIONS = {
  // Static pages (ISR)
  staticPages: {
    strategy: 'public-long' as CacheStrategy,
    description: 'Pages with revalidate >= 3600 (accounts, classes, roles)',
    ttl: 3600,
  },

  // Semi-static pages (ISR)
  semiStaticPages: {
    strategy: 'public-medium' as CacheStrategy,
    description: 'Pages with revalidate 30-300 (violation-entry, stats)',
    ttl: 300,
  },

  // Dynamic pages
  dynamicPages: {
    strategy: 'swr-short' as CacheStrategy,
    description: 'Pages with force-dynamic (game, auth redirects)',
    ttl: 30,
  },

  // API routes (GET)
  apiRead: {
    strategy: 'public-short' as CacheStrategy,
    description: 'GET endpoints returning data',
    ttl: 60,
  },

  // API routes (POST/PUT/DELETE)
  apiWrite: {
    strategy: 'no-cache' as CacheStrategy,
    description: 'Mutation endpoints',
    ttl: 0,
  },
} as const;

/**
 * Check if response should be cached based on status code
 */
export function shouldCache(statusCode: number): boolean {
  // Only cache successful responses
  return statusCode >= 200 && statusCode < 300;
}

/**
 * Add Vary header for proper cache key generation
 * 
 * @example
 * ```ts
 * const headers = createCacheHeaders('public-short');
 * addVaryHeader(headers, ['Accept', 'Authorization']);
 * ```
 */
export function addVaryHeader(
  headers: Record<string, string>,
  varyOn: string[]
): void {
  headers['Vary'] = varyOn.join(', ');
}
