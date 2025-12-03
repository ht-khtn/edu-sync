import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export type ProxySession = {
  userId: string | null
  isAuthenticated: boolean
  hasAdminRole: boolean
  hasOlympiaRole: boolean
  roles: string[]
}

/**
 * Lightweight session check for proxy/middleware
 * Does NOT do heavy DB queries - only checks auth cookies
 */
export async function getProxySession(request: NextRequest): Promise<ProxySession> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  let userId: string | null = null
  let roles: string[] = []

  try {
    // Extract auth token from cookies
    const authCookie = request.cookies.get('sb-access-token')?.value
    
    // Fast path: no auth cookie = not authenticated
    if (!authCookie) {
      return {
        userId: null,
        isAuthenticated: false,
        hasAdminRole: false,
        hasOlympiaRole: false,
        roles: [],
      }
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${authCookie}` },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      userId = user.id

      // Quick role check - only fetch role_ids, not full permission details
      const { data: appUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_uid', user.id)
        .maybeSingle()

      if (appUser?.id) {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role_id')
          .eq('user_id', appUser.id)

        if (Array.isArray(userRoles)) {
          roles = userRoles.map((r) => r.role_id?.toUpperCase() || '').filter(Boolean)
        }
      }
    }
  } catch (error) {
    // Silent fail - treat as unauthenticated
    console.error('[proxy-auth] Error getting session:', error)
  }

  const isAuthenticated = !!userId
  const hasAdminRole = roles.includes('AD') || roles.includes('MOD') || roles.includes('CC')
  const hasOlympiaRole = roles.includes('HOST') || roles.includes('PLAYER')

  return {
    userId,
    isAuthenticated,
    hasAdminRole,
    hasOlympiaRole,
    roles,
  }
}

export function isProtectedAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin')
}

export function isProtectedClientRoute(pathname: string): boolean {
  return pathname.startsWith('/client')
}

export function isProtectedOlympiaRoute(pathname: string): boolean {
  return pathname.startsWith('/olympia')
}

export function isLoginRoute(pathname: string): boolean {
  return pathname === '/login'
}

export function getDashboardForUser(session: ProxySession): string {
  // Priority: Admin > Olympia > Client
  if (session.hasAdminRole) {
    return '/admin'
  }
  if (session.hasOlympiaRole) {
    return '/olympia'
  }
  return '/client'
}
