"use client"

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from './AuthProvider'
import getSupabase from '@/lib/supabase'

export default function AuthNav() {
  const auth = useAuth()
  const [loading, setLoading] = useState(false)

  async function signOut() {
    setLoading(true)
    try {
      const supabase = await getSupabase()
      await supabase.auth.signOut()
      // simple client redirect
      window.location.href = '/'
    } catch (e) {
      console.warn('signOut error', e)
      setLoading(false)
    }
  }

  if (!auth.userId) {
    return <Link href="/login" className="inline-block">Đăng nhập</Link>
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Xin chào</span>
      <Button size="sm" variant="ghost" onClick={signOut} disabled={loading}>Đăng xuất</Button>
    </div>
  )
}
