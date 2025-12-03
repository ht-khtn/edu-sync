"use client"

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import NotificationsBell from '@/components/common/NotificationsBell'
import { useSession } from '@/hooks/useSession'

export default function NavClient() {
  const { data: info, isLoading: loading, refetch } = useSession()
  const router = useRouter()
  const manualLogoutRef = useRef<boolean>(false)
  const lastSignedOutToastAtRef = useRef<number>(0)

  const [selfRoles, setSelfRoles] = useState<{ hasSelf: boolean } | null>(null)

  useEffect(() => {
    if (selfRoles !== null) return
    if (!info || !info.user) return
    ;(async () => {
      try {
        const supabase = await getSupabase()
        const { data: roles } = await supabase.from('user_roles').select('role_id').eq('user_id', info.user!.id)
        const hasSelf = Array.isArray(roles) && roles.some((r) => r.role_id === 'S' || r.role_id === 'YUM' || r.role_id === 'CC')
        setSelfRoles({ hasSelf })
      } catch { setSelfRoles({ hasSelf: false }) }
    })()
  }, [info, selfRoles])

  useEffect(() => {
    let unsub: (() => void) | null = null
    ;(async () => {
      try {
        const supabase = await getSupabase()
        const { data } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') {
            setSelfRoles(null)
            refetch()
          } else if (event === 'SIGNED_OUT') {
            setSelfRoles(null)
            if (!manualLogoutRef.current) {
              const now = Date.now()
              if (now - lastSignedOutToastAtRef.current > 2000) {
                lastSignedOutToastAtRef.current = now
                toast.success('Đăng xuất thành công')
              }
            }
          }
        })
        unsub = data?.subscription?.unsubscribe ?? (() => {})
      } catch {}
    })()

    return () => {
      try { if (unsub) unsub() } catch {}
    }
  }, [refetch])

  if (loading) return <li className="text-sm text-zinc-500">Đang tải…</li>
  if (!info || !info.user) return <Link href="/login">Đăng nhập</Link>

  const hasCC = !!info.hasCC
  const hasSchoolScope = !!info.hasSchoolScope
  const ccClassId = info.ccClassId

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
                {hasCC && !hasSchoolScope && (
                  <DropdownMenuItem>
                    <Link href="/admin/violation-entry" className="block w-full">Nhập vi phạm</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <Link href={ccClassId && !hasSchoolScope ? `/admin/violation-history?classId=${ccClassId}` : '/admin/violation-history'} className="block w-full">Lịch sử ghi nhận</Link>
                </DropdownMenuItem>
                {hasSchoolScope && (
                  <DropdownMenuItem>
                    <Link href="/admin/violation-stats" className="block w-full">Thống kê vi phạm</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        </>
      )}
      {(selfRoles?.hasSelf || hasCC) && (
        <li>
          <Link href="/client/my-violations" className="text-sm text-zinc-700 hover:text-zinc-900">Vi phạm của tôi</Link>
        </li>
      )}
      <li>
        <button
          onClick={async () => {
            if (loading) return
            manualLogoutRef.current = true
            try {
              const supabase = await getSupabase()
              try { await supabase.auth.signOut() } catch {}
              setSelfRoles(null)
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
              toast.success('Đăng xuất thành công')
            } catch {
              toast.error('Đăng xuất thất bại')
            } finally {
              router.replace('/login')
              setTimeout(() => { manualLogoutRef.current = false }, 1000)
            }
          }}
          disabled={loading}
          className="text-zinc-700 hover:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? 'Đang xử lý...' : 'Đăng xuất'}
        </button>
      </li>
    </>
  )
}
