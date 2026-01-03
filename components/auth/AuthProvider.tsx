"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import getSupabase from '@/lib/supabase'

type Role = { role_id: string; target: string | null }

type AuthState = {
  loading: boolean
  userId: string | null
  roles: Role[]
  classTargets: string[]
  homeroomOf: string[]
  canComplaint: boolean
}

const AuthCtx = createContext<AuthState>({
  loading: true,
  userId: null,
  roles: [],
  classTargets: [],
  homeroomOf: [],
  canComplaint: false,
})

export function useAuth() {
  return useContext(AuthCtx)
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: null,
    roles: [],
    classTargets: [],
    homeroomOf: [],
    canComplaint: false,
  })
  const userIdRef = useRef<string | null>(null)

  const syncAccessTokenCookie = (accessToken: string | null) => {
    if (typeof document === 'undefined') return
    const base = 'path=/; samesite=lax'
    if (!accessToken) {
      document.cookie = `sb-access-token=; max-age=0; ${base}`
      document.cookie = `sb-access-token-public=; max-age=0; ${base}`
      return
    }

    const encoded = encodeURIComponent(accessToken)
    // Không có cách set expires khớp JWT exp từ client; set max-age dài để luôn có token mới được sync.
    // Token thực tế vẫn được Supabase refresh định kỳ.
    const maxAge = 60 * 60 * 24 * 30
    document.cookie = `sb-access-token=${encoded}; max-age=${maxAge}; ${base}`
    document.cookie = `sb-access-token-public=${encoded}; max-age=${maxAge}; ${base}`
  }

  const syncRealtimeAuth = (supabase: unknown, accessToken: string | null) => {
    if (!accessToken) return
    try {
      const realtime = (supabase as { realtime?: { setAuth?: (token: string) => void } }).realtime
      realtime?.setAuth?.(accessToken)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    userIdRef.current = state.userId
  }, [state.userId])

  useEffect(() => {
    let mounted = true
    let cleanup: (() => void) | undefined
      ; (async () => {
        try {
          const supabase = await getSupabase()
          const { data: session } = await supabase.auth.getSession()
          syncAccessTokenCookie(session.session?.access_token ?? null)
          syncRealtimeAuth(supabase, session.session?.access_token ?? null)
          const authUid = session.session?.user.id ?? null

          if (!authUid) {
            if (mounted) setState((s) => ({ ...s, loading: false }))
          } else {
            // Step 1: Get public.users.id from auth_uid
            const { data: appUser } = await supabase
              .from('users')
              .select('id')
              .eq('auth_uid', authUid)
              .maybeSingle()

            if (!appUser?.id) {
              // User not found in system
              if (mounted) setState((s) => ({ ...s, loading: false }))
              return
            }

            const userId = appUser.id

            // Step 2: Fetch roles and classes (now with correct user_id)
            const [{ data: roles, error: rErr }, { data: classes, error: cErr }] = await Promise.all([
              supabase.from('user_roles').select('role_id,target').eq('user_id', userId),
              supabase.from('classes').select('id').eq('homeroom_teacher_id', userId),
            ])

            if (rErr) console.warn('user_roles error', rErr.message)
            if (cErr) console.warn('classes homeroom error', cErr.message)

            const classTargets = (roles || [])
              .filter((r) => r.role_id === 'CC' && r.target)
              .map((r) => String(r.target))
            const homeroomOf = (classes || []).map((c) => String(c.id))
            const canComplaint = homeroomOf.length > 0

            if (mounted)
              setState({
                loading: false,
                userId: userId,
                roles: (roles as Role[]) || [],
                classTargets,
                homeroomOf,
                canComplaint,
              })
          }

          // subscribe to auth changes to keep client state and server components in sync
          try {
            const { data: subscription } = supabase.auth.onAuthStateChange((event, sess) => {
              if (!mounted) return
              try { router.refresh() } catch { }

              // TOKEN_REFRESHED cũng đi qua đây → sync cookie để SSR/server action không bị dùng token cũ.
              syncAccessTokenCookie(sess?.access_token ?? null)
              syncRealtimeAuth(supabase, sess?.access_token ?? null)

              const newAuthUid = sess?.user?.id ?? null
              if (!newAuthUid) {
                setState((s) => ({ ...s, userId: null, loading: false, roles: [], classTargets: [], homeroomOf: [], canComplaint: false }))
              }
              if (newAuthUid && newAuthUid !== userIdRef.current) {
                // refetch roles for new session
                ; (async () => {
                  try {
                    // Step 1: Get public.users.id from auth_uid
                    const { data: appUser } = await supabase
                      .from('users')
                      .select('id')
                      .eq('auth_uid', newAuthUid)
                      .maybeSingle()

                    if (!appUser?.id) return

                    const newUserId = appUser.id

                    // Step 2: Fetch roles and classes
                    const [{ data: roles }, { data: classes }] = await Promise.all([
                      supabase.from('user_roles').select('role_id,target').eq('user_id', newUserId),
                      supabase.from('classes').select('id').eq('homeroom_teacher_id', newUserId),
                    ])
                    const classTargets = (roles || [])
                      .filter((r) => r.role_id === 'CC' && r.target)
                      .map((r) => String(r.target))
                    const homeroomOf = (classes || []).map((c) => String(c.id))
                    const canComplaint = homeroomOf.length > 0
                    if (mounted) setState({ loading: false, userId: newUserId, roles: (roles as Role[]) || [], classTargets, homeroomOf, canComplaint })
                  } catch { }
                })()
              }
            })
            cleanup = () => {
              try {
                subscription?.subscription?.unsubscribe?.()
              } catch {
                // ignore
              }
            }
          } catch { }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          console.warn('AuthProvider init error', message)
          if (mounted) setState((s) => ({ ...s, loading: false }))
        }
      })()
    return () => {
      mounted = false
      if (cleanup) cleanup()
    }
  }, [router])



  const value = useMemo(() => state, [state])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
