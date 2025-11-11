"use client"

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: null,
    roles: [],
    classTargets: [],
    homeroomOf: [],
    canComplaint: false,
  })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const supabase = await getSupabase()
        const { data: session } = await supabase.auth.getSession()
        const uid = session.session?.user.id ?? null
        if (!uid) {
          if (mounted) setState((s) => ({ ...s, loading: false }))
          return
        }

        const [{ data: roles, error: rErr }, { data: classes, error: cErr }] = await Promise.all([
          supabase.from('user_roles').select('role_id,target').eq('user_id', uid),
          supabase.from('classes').select('id').eq('homeroom_teacher_id', uid),
        ])
        if (rErr) console.warn('user_roles error', rErr.message)
        if (cErr) console.warn('classes homeroom error', cErr.message)

        const classTargets = (roles || [])
          .filter((r) => r.role_id === 'CC' && r.target)
          .map((r) => String(r.target))
        const homeroomOf = (classes || []).map((c: any) => String(c.id))
        const canComplaint = homeroomOf.length > 0

        if (mounted)
          setState({
            loading: false,
            userId: uid,
            roles: (roles as Role[]) || [],
            classTargets,
            homeroomOf,
            canComplaint,
          })
        // subscribe to auth changes to keep client state and server components in sync
        try {
          const { data: subscription } = supabase.auth.onAuthStateChange((event, sess) => {
            if (!mounted) return
            // refresh server components so header and other RSCs update
            try {
              // use next/navigation's router to refresh
              // (router declared below via hook)
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              router.refresh()
            } catch {}

            const newUid = sess?.user?.id ?? null
            if (!newUid) {
              setState((s) => ({ ...s, userId: null, loading: false, roles: [], classTargets: [], homeroomOf: [], canComplaint: false }))
            }
          })
          // cleanup on unmount
          ;(subscription as any)?.unsubscribe?.()
        } catch {}
      } catch (e: any) {
        console.warn('AuthProvider init error', e?.message)
        if (mounted) setState((s) => ({ ...s, loading: false }))
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const router = useRouter()

  const value = useMemo(() => state, [state])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
