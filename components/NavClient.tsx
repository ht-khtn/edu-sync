"use client"

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import NotificationsBell from '@/components/common/NotificationsBell'

type SessionInfo = { user: { id: string } | null; hasCC?: boolean; hasSchoolScope?: boolean; ccClassId?: string | null }

export default function NavClient() {
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const isSignedInRef = useRef<boolean>(false)
  const usedFallbackRef = useRef<boolean>(false)
  const manualLogoutRef = useRef<boolean>(false)
  const lastSignedOutToastAtRef = useRef<number>(0)

  // Rate-limit + dedupe server session fetches to avoid bursts
  const fetchingRef = useRef<boolean>(false)
  const lastFetchAtRef = useRef<number>(0)
  const MIN_FETCH_INTERVAL = 3000 // ms

  // Must declare hooks unconditionally before any early returns
  const [selfRoles, setSelfRoles] = useState<{ hasSelf: boolean } | null>(null)
  useEffect(() => {
    if (selfRoles !== null) return
    if (!info || !info.user) return
    ;(async () => {
      try {
        const supabase = await getSupabase()
        const { data: roles } = await supabase.from('user_roles').select('role_id').eq('user_id', info.user!.id)
        const hasSelf = Array.isArray(roles) && roles.some((r: any) => r.role_id === 'S' || r.role_id === 'YUM')
        setSelfRoles({ hasSelf })
      } catch { setSelfRoles({ hasSelf: false }) }
    })()
  }, [info, selfRoles])

  async function fetchInfo(force = false) {
    const now = Date.now()
    if (!force) {
      if (fetchingRef.current) return
      if (now - lastFetchAtRef.current < MIN_FETCH_INTERVAL) return
    }
    fetchingRef.current = true
    lastFetchAtRef.current = now
    try {
      const res = await fetch('/api/session', { cache: 'no-store' })
      const json = await res.json()
      // If client believes we're signed in but server still returns null (cookie race),
      // do not overwrite to null to avoid flicker.
      if (!json?.user && isSignedInRef.current) {
        // keep existing info until server catches up
        return
      }
      setInfo(json)
    } catch (e) {
      // don't force null during transient failures if client is signed in
      if (!isSignedInRef.current) setInfo(null)
    }
    setLoading(false)
    fetchingRef.current = false
  }

  async function deriveRolesClientFallback() {
    // If server session not yet visible but we have a client Supabase session, derive role flags directly.
    try {
      const supabase = await getSupabase()
      const { data: userRes } = await supabase.auth.getUser()
      const authUid = userRes?.user?.id
      if (!authUid) return
      const { data: appUser } = await supabase.from('users').select('id').eq('auth_uid', authUid).maybeSingle()
      const appUserId = appUser?.id as string | undefined
      if (!appUserId) return
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role_id,target,permissions(scope)')
        .eq('user_id', appUserId)
      const roleList = Array.isArray(roles) ? roles : []
      const hasSchoolScope = roleList.some((r: any) => r?.permissions?.scope === 'school')
      const hasCC = roleList.some((r: any) => r.role_id === 'CC')
      let ccClassId: string | null = null
      if (hasCC && !hasSchoolScope) {
        const ccRole = roleList.find((r: any) => r.role_id === 'CC' && r.target)
        if (ccRole?.target) {
          const { data: cls } = await supabase.from('classes').select('id').eq('name', ccRole.target).maybeSingle()
          ccClassId = cls?.id ?? null
        }
      }
      usedFallbackRef.current = true
      setInfo({ user: { id: appUserId }, hasCC, hasSchoolScope, ccClassId })
      setLoading(false)
    } catch {}
  }

  useEffect(() => {
    let unsub: (() => void) | null = null
    ;(async () => {
      try {
        const supabase = await getSupabase()
        // Set initial auth state
        const { data: initial } = await supabase.auth.getUser()
        isSignedInRef.current = !!initial?.user

  await fetchInfo(true)
        if (!info?.user && isSignedInRef.current) {
          // If server not ready but client is signed in, use fallback once
          await deriveRolesClientFallback()
        }

        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN') {
            isSignedInRef.current = true
            // Prefer server; fallback only if still null
            fetchInfo(true).then(async () => {
              if (!info?.user) await deriveRolesClientFallback()
            })
          } else if (event === 'SIGNED_OUT') {
            isSignedInRef.current = false
            usedFallbackRef.current = false
            setInfo(null)
            // If logout was initiated by our UI, the button handler will show success toast.
            // Otherwise, debounce a success toast in case multiple events fire.
            if (!manualLogoutRef.current) {
              const now = Date.now()
              if (now - lastSignedOutToastAtRef.current > 2000) {
                lastSignedOutToastAtRef.current = now
                toast.success('Đăng xuất thành công')
              }
            }
          }
        })
        // @ts-ignore
        unsub = data?.subscription?.unsubscribe || (() => {})
      } catch {}
    })()

    return () => {
      try { if (unsub) unsub() } catch {}
    }
  }, [])

  if (loading) return <li className="text-sm text-zinc-500">Đang tải…</li>
  if (!info || !info.user) return <Link href="/login">Đăng nhập</Link>

  const hasCC = !!info.hasCC
  const hasSchoolScope = !!info.hasSchoolScope
  const ccClassId = info.ccClassId

  // We'll derive student/self roles (S, YUM) client-side for nav visibility by querying roles once when menu renders.
  // Lightweight: only fetch if we don't already have management roles.

  return (
    <>
      <li><NotificationsBell /></li>
      { (hasCC || hasSchoolScope) && (
        <>
          <li>
            <DropdownMenu>
              <DropdownMenuTrigger className="text-zinc-700 hover:text-zinc-900 focus:outline-none text-sm">
                Quản lý vi phạm ▾
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {hasCC && (
                  <DropdownMenuItem>
                    <Link href="/violation-entry" className="block w-full">Nhập vi phạm</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <Link href={ccClassId && !hasSchoolScope ? `/violation-history?classId=${ccClassId}` : '/violation-history'} className="block w-full">Lịch sử ghi nhận</Link>
                </DropdownMenuItem>
                {hasSchoolScope && (
                  <DropdownMenuItem>
                    <Link href="/violation-stats" className="block w-full">Thống kê vi phạm</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
          {hasCC && !hasSchoolScope && <li><Link href="/score-entry">Nhập điểm</Link></li>}
        </>
      )}
      {selfRoles?.hasSelf && (
        <li>
          <Link href="/my-violations" className="text-sm text-zinc-700 hover:text-zinc-900">Vi phạm của tôi</Link>
        </li>
      )}
      <li>
        <button
          onClick={async () => {
            if (loading) return
            setLoading(true)
            manualLogoutRef.current = true
            try {
              const supabase = await getSupabase()
              try { await supabase.auth.signOut() } catch {}
              isSignedInRef.current = false
              usedFallbackRef.current = false
              setInfo(null)
              // Single server logout request (no repeat) + toast
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
              toast.success('Đăng xuất thành công')
            } catch (e: any) {
              toast.error('Đăng xuất thất bại')
            } finally {
              setLoading(false)
              router.replace('/login')
              // Reset the manual flag shortly after navigation
              setTimeout(() => { manualLogoutRef.current = false }, 1000)
            }
          }}
          disabled={loading}
          className="text-zinc-700 hover:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Đang xử lý...' : 'Đăng xuất'}
        </button>
      </li>
    </>
  )
}
