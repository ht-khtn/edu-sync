"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type SessionInfo = { user: { id: string } | null; hasCC?: boolean; hasSchoolScope?: boolean; ccClassId?: string | null }

export default function NavClient() {
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const router = useRouter()

  async function fetchInfo() {
    try {
      const res = await fetch('/api/session', { cache: 'no-store' })
      const json = await res.json()
      setInfo(json)
    } catch (e) {
      setInfo(null)
    }
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
      setInfo({ user: { id: appUserId }, hasCC, hasSchoolScope, ccClassId })
    } catch {}
  }

  useEffect(() => {
    fetchInfo().then(() => {
      // If after initial fetch we still have no user but client session exists, fallback.
      if (!info?.user) deriveRolesClientFallback()
    })

    // Listen to Supabase auth changes to refresh menu immediately
    let unsub: (() => void) | null = null
    ;(async () => {
      try {
        const supabase = await getSupabase()
        const { data } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') {
            // Attempt server fetch first
            fetchInfo().then(() => {
              // If server still not reflecting roles, derive client-side immediately
              if (!info?.user) deriveRolesClientFallback()
            })
            router.refresh()
          } else if (event === 'SIGNED_OUT') {
            setInfo(null)
          }
        })
        // store unsubscribe
        // @ts-ignore
        unsub = data?.subscription?.unsubscribe || (() => {})
      } catch (e) {
        // ignore
      }
    })()

    return () => {
      try {
        if (unsub) unsub()
      } catch {}
    }
  }, [])

  if (!info || !info.user) return <Link href="/login">Đăng nhập</Link>

  const hasCC = !!info.hasCC
  const hasSchoolScope = !!info.hasSchoolScope
  const ccClassId = info.ccClassId

  return (
    <>
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
      <li>
        <button
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
              // after logout, refresh nav and redirect to login
              setInfo(null)
              router.push('/login')
            } catch {
              router.push('/login')
            }
          }}
          className="text-zinc-700 hover:text-zinc-900"
        >
          Đăng xuất
        </button>
      </li>
    </>
  )
}
