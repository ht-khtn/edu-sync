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
      const res = await fetch('/api/session')
      const json = await res.json()
      setInfo(json)
    } catch (e) {
      setInfo(null)
    }
  }

  useEffect(() => {
    fetchInfo()

    // Listen to Supabase auth changes to refresh menu immediately
    let unsub: (() => void) | null = null
    ;(async () => {
      try {
        const supabase = await getSupabase()
        const { data } = supabase.auth.onAuthStateChange((event) => {
          // on any auth change, re-fetch session info from server
          fetchInfo()
          // when signed in, force a router refresh so server components update if needed
          if (event === 'SIGNED_IN') router.refresh()
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
              await fetch('/api/auth/logout', { method: 'POST' })
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
