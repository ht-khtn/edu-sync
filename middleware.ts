import { NextResponse, type NextRequest } from 'next/server'

const envHost = process.env.OLYMPIA_HOST?.toLowerCase().trim()
const DEFAULT_PREFIX = 'olympia.'

function isOlympiaHost(host: string | null): boolean {
  if (!host) return false
  const normalized = host.toLowerCase()
  if (envHost) return normalized === envHost
  return normalized.startsWith(DEFAULT_PREFIX)
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')
  const url = request.nextUrl.clone()
  const pathname = url.pathname

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

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
