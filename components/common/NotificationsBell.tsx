"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'

export default function NotificationsBell() {
  const [items, setItems] = useState<Array<{ id: string; title: string | null; body: string | null; created_at: string; read_at: string | null }>>([])
  const [unread, setUnread] = useState<number>(0)
  const mounted = useRef(false)
  const subscribed = useRef(false)

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    let active = true
    ;(async () => {
      try {
        const supabase = await getSupabase()
        const { data: me } = await supabase.auth.getUser()
        if (!me?.user) return // not signed in -> hide

        // initial fetch
        const { data } = await supabase
          .from('notifications')
          .select('id,title,body,created_at,read_at')
          .order('created_at', { ascending: false })
          .limit(20)
        if (!active) return
        const rows = data || []
        setItems(rows as any)
        setUnread((rows as any).filter((r: any) => !r.read_at).length)

        if (subscribed.current) return
        subscribed.current = true
        const channel = supabase
          .channel('notif-inserts')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
            const row = payload.new
            // RLS ensures only my rows are emitted; still defensive check
            if (!active) return
            setItems((prev) => [row, ...prev].slice(0, 20))
            setUnread((n) => n + 1)
            const title = row?.title || 'Thông báo'
            const body = row?.body || ''
            toast.info(title + (body ? `: ${body}` : ''))
          })
          .subscribe()

        return () => {
          active = false
          try { supabase.removeChannel(channel) } catch {}
        }
      } catch {}
    })()
  }, [])

  async function markAllRead() {
    try {
      const supabase = await getSupabase()
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
      setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at || new Date().toISOString() })))
      setUnread(0)
    } catch {}
  }

  if (!items.length && unread === 0) {
    // Keep the bell visible, but no badge
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Thông báo">
            <Bell className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="p-3 text-sm text-muted-foreground">Không có thông báo</div>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Thông báo">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] h-4 min-w-4 px-1">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="text-sm font-medium">Thông báo</div>
          <Button variant="ghost" size="sm" className="text-xs" onClick={markAllRead}>Đánh dấu đã đọc</Button>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-auto">
          {items.length === 0 && <div className="p-3 text-sm text-muted-foreground">Không có thông báo</div>}
          {items.map((n) => (
            <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2">
              <div className="w-full flex items-center justify-between">
                <span className="text-sm font-medium">{n.title || 'Thông báo'}</span>
                {!n.read_at && <span className="text-[10px] rounded px-1.5 py-0.5 bg-indigo-50 text-indigo-700">Mới</span>}
              </div>
              <div className="text-xs text-muted-foreground w-full whitespace-pre-wrap">{n.body}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {new Date(n.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
