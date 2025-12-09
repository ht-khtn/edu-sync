/**
 * Cache Middleware for Next.js
 * 
 * Automatically applies appropriate cache headers based on route patterns
 * Works with Vercel Edge Network for optimal caching
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCacheStrategyForRoute, createCacheHeaders } from '@/lib/cache-headers';

/**
 * Middleware to add cache headers to responses
 * 
 * This runs on Vercel Edge, before the request reaches your app
 * Adds Cache-Control headers based on route patterns
 */
export function cacheMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for certain paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Get appropriate cache strategy for this route
  const strategy = getCacheStrategyForRoute(pathname);
  
  // Clone response and add cache headers
  const response = NextResponse.next();
  const headers = createCacheHeaders(strategy);
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Matcher configuration for middleware
 * Only run on API routes and dynamic pages
 */
export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
