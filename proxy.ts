import { NextResponse, type NextRequest } from "next/server";
import {
  getProxySession,
  isProtectedAdminRoute,
  isProtectedClientRoute,
  isProtectedOlympiaRoute,
  isLoginRoute,
  getDashboardForUser,
} from "@/lib/proxy-auth";

const envHost = process.env.OLYMPIA_HOST?.toLowerCase().trim();
const DEFAULT_PREFIX = "olympia.";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function isOlympiaHost(host: string | null): boolean {
  if (!host) return false;
  const normalized = host.toLowerCase();
  if (envHost) return normalized === envHost;
  return normalized.startsWith(DEFAULT_PREFIX);
}

type RefreshedTokens = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
};

async function refreshTokens(refreshToken: string): Promise<RefreshedTokens | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as RefreshedTokens;
    if (!data?.access_token) return null;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? refreshToken,
      expires_in: data.expires_in,
    };
  } catch {
    return null;
  }
}

function applyAuthCookies(response: NextResponse, request: NextRequest, tokens: RefreshedTokens) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.toLowerCase();
  const secure = forwardedProto
    ? forwardedProto === "https"
    : request.nextUrl.protocol === "https:";
  response.cookies.set("sb-access-token", tokens.access_token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    maxAge:
      typeof tokens.expires_in === "number" && tokens.expires_in > 0 ? tokens.expires_in : 60 * 60,
  });

  // Cookie phụ để client-side Supabase (storage/realtime) có thể đọc JWT.
  // Giữ cookie chính httpOnly để an toàn hơn cho SSR.
  response.cookies.set("sb-access-token-public", tokens.access_token, {
    httpOnly: false,
    path: "/",
    sameSite: "lax",
    secure,
    maxAge:
      typeof tokens.expires_in === "number" && tokens.expires_in > 0 ? tokens.expires_in : 60 * 60,
  });

  response.cookies.set("sb-refresh-token", tokens.refresh_token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    maxAge: ONE_YEAR_SECONDS,
  });
}

/**
 * Centralized proxy for auth/authorization and Olympia subdomain routing
 * Handles redirects based on authentication status and roles
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const url = request.nextUrl.clone();
  const { pathname } = request.nextUrl;

  // Public Olympia routes (MC / Guest) không bắt buộc đăng nhập
  const isPublicOlympiaRoute =
    pathname === "/olympia/mc" ||
    pathname.startsWith("/olympia/mc/") ||
    pathname.startsWith("/olympia/client/admin") ||
    pathname.startsWith("/olympia/client/guest") ||
    pathname.startsWith("/olympia/client/watch") ||
    pathname.startsWith("/olympia/client/join") ||
    pathname.startsWith("/olympia/client/how-to-join");

  // Skip static assets and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap")
  ) {
    return NextResponse.next();
  }

  // Handle Olympia subdomain routing (from old middleware.ts)
  const onOlympiaHost = isOlympiaHost(host);
  const isOlympiaPath = pathname.startsWith("/olympia");

  if (onOlympiaHost && !isOlympiaPath) {
    url.pathname = pathname === "/" ? "/olympia" : `/olympia${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (!onOlympiaHost && isOlympiaPath) {
    if (envHost) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.hostname = envHost;
      return NextResponse.redirect(redirectUrl);
    }
    // No dedicated host configured, allow direct access on current domain
    return NextResponse.next();
  }

  // Check if route needs auth BEFORE doing expensive session check
  const needsAuth =
    isProtectedAdminRoute(pathname) ||
    isProtectedClientRoute(pathname) ||
    isProtectedOlympiaRoute(pathname) ||
    isLoginRoute(pathname) ||
    pathname === "/"; // Also check root path for redirect

  if (!needsAuth) {
    // Public route - skip auth check entirely for better performance
    return NextResponse.next();
  }

  // Auth/authorization checks (only for protected routes)
  const refreshToken = request.cookies.get("sb-refresh-token")?.value ?? null;
  let accessToken = request.cookies.get("sb-access-token")?.value ?? null;
  let refreshed: RefreshedTokens | null = null;

  // Nếu access token cookie đã hết hạn nhưng refresh token còn, refresh ngay.
  if (!accessToken && refreshToken) {
    refreshed = await refreshTokens(refreshToken);
    accessToken = refreshed?.access_token ?? null;
  }

  let session = await getProxySession(request, accessToken);

  // Nếu access token tồn tại nhưng không hợp lệ (hoặc vừa hết hạn), thử refresh rồi check lại.
  if (!session.isAuthenticated && refreshToken && !refreshed) {
    refreshed = await refreshTokens(refreshToken);
    accessToken = refreshed?.access_token ?? null;
    if (accessToken) {
      session = await getProxySession(request, accessToken);
    }
  }

  const finalize = (resp: NextResponse) => {
    if (refreshed) applyAuthCookies(resp, request, refreshed);
    return resp;
  };

  // Rule 1: Protect admin routes
  if (isProtectedAdminRoute(pathname)) {
    if (!session.isAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return finalize(NextResponse.redirect(url));
    }
    if (!session.hasAdminRole) {
      // User is authenticated but doesn't have admin role
      const url = request.nextUrl.clone();
      url.pathname = getDashboardForUser(session);
      return finalize(NextResponse.redirect(url));
    }
  }

  // Rule 2: Protect client routes
  if (isProtectedClientRoute(pathname)) {
    if (!session.isAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return finalize(NextResponse.redirect(url));
    }
  }

  // Rule 3: Protect olympia routes
  if (isProtectedOlympiaRoute(pathname)) {
    if (isPublicOlympiaRoute) {
      return finalize(NextResponse.next());
    }
    if (!session.isAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return finalize(NextResponse.redirect(url));
    }
  }

  // Rule 4: Redirect authenticated users away from login page
  if (isLoginRoute(pathname)) {
    if (session.isAuthenticated) {
      const url = request.nextUrl.clone();
      // Check if there's a redirect parameter
      const redirect = url.searchParams.get("redirect");
      if (redirect && redirect.startsWith("/")) {
        url.pathname = redirect;
        url.searchParams.delete("redirect");
      } else {
        url.pathname = getDashboardForUser(session);
      }
      return finalize(NextResponse.redirect(url));
    }
  }

  // Rule 5: Handle root path redirect
  if (pathname === "/") {
    if (session.isAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = getDashboardForUser(session);
      return finalize(NextResponse.redirect(url));
    } else {
      // Not authenticated - let page handle the redirect to /client
      return finalize(NextResponse.next());
    }
  }

  return finalize(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
