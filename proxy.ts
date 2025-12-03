import { NextResponse, type NextRequest } from 'next/server'
import {
  getProxySession,
  isProtectedAdminRoute,
  isProtectedClientRoute,
  isProtectedOlympiaRoute,
  isLoginRoute,
  getDashboardForUser,
} from '@/lib/proxy-auth'

const envHost = process.env.OLYMPIA_HOST?.toLowerCase().trim()
const DEFAULT_PREFIX = 'olympia.'

function isOlympiaHost(host: string | null): boolean {
  if (!host) return false
  const normalized = host.toLowerCase()
  if (envHost) return normalized === envHost
  return normalized.startsWith(DEFAULT_PREFIX)
}

/**
 * Centralized proxy for auth/authorization and Olympia subdomain routing
 * Handles redirects based on authentication status and roles
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get('host')
  const url = request.nextUrl.clone()
  const { pathname } = request.nextUrl

  // Skip static assets and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots') ||
    pathname.startsWith('/sitemap')
  ) {
    return NextResponse.next()
  }

  // Handle Olympia subdomain routing (from old middleware.ts)
  const onOlympiaHost = isOlympiaHost(host)
  const isOlympiaPath = pathname.startsWith('/olympia')

  if (onOlympiaHost && !isOlympiaPath) {
    url.pathname = pathname === '/' ? '/olympia' : `/olympia${pathname}`
    return NextResponse.rewrite(url)
  }

  if (!onOlympiaHost && isOlympiaPath) {
    url.pathname = pathname.replace(/^\/olympia/, '') || '/'
    return NextResponse.redirect(url)
  }

  // Check if route needs auth BEFORE doing expensive session check
  const needsAuth = isProtectedAdminRoute(pathname) || 
                    isProtectedClientRoute(pathname) || 
                    isProtectedOlympiaRoute(pathname) ||
                    isLoginRoute(pathname)
  
  if (!needsAuth) {
    // Public route - skip auth check entirely for better performance
    return NextResponse.next()
  }

  // Auth/authorization checks (only for protected routes)
  const session = await getProxySession(request)

  // Rule 1: Protect admin routes
  if (isProtectedAdminRoute(pathname)) {
    if (!session.isAuthenticated) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    if (!session.hasAdminRole) {
      // User is authenticated but doesn't have admin role
      const url = request.nextUrl.clone()
      url.pathname = getDashboardForUser(session)
      return NextResponse.redirect(url)
    }
  }

  // Rule 2: Protect client routes
  if (isProtectedClientRoute(pathname)) {
    if (!session.isAuthenticated) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
  }

  // Rule 3: Protect olympia routes
  if (isProtectedOlympiaRoute(pathname)) {
    if (!session.isAuthenticated) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
  }

  // Rule 4: Redirect authenticated users away from login page
  if (isLoginRoute(pathname)) {
    if (session.isAuthenticated) {
      const url = request.nextUrl.clone()
      // Check if there's a redirect parameter
      const redirect = url.searchParams.get('redirect')
      if (redirect && redirect.startsWith('/')) {
        url.pathname = redirect
        url.searchParams.delete('redirect')
      } else {
        url.pathname = getDashboardForUser(session)
      }
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
