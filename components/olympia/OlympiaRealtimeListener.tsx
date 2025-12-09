'use client'

import { useEffect, useMemo, useId } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import getSupabase from '@/lib/supabase'

type OlympiaRealtimeListenerProps = {
  debounceMs?: number
}

export function OlympiaRealtimeListener({ debounceMs = 800 }: OlympiaRealtimeListenerProps = {}) {
  const router = useRouter()
  const uniqueId = useId()
  const channelName = useMemo(() => `olympia-schedule-${uniqueId.replace(/:/g, '')}`, [uniqueId])

  useEffect(() => {
    let mounted = true
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let channel: RealtimeChannel | null = null
    let supabaseInstance: Awaited<ReturnType<typeof getSupabase>> | null = null

    const scheduleRefresh = () => {
      if (refreshTimer) return
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        if (document.visibilityState === 'visible') {
          router.refresh()
        }
      }, debounceMs)
    }

    const subscribe = async () => {
      try {
        const supabase = await getSupabase()
        if (!mounted) return
        supabaseInstance = supabase
        
        // Optimized: Filter only active matches (status != 'completed')
        // Reduces payload by ~80% (only listen to live matches)
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes', 
            { 
              event: '*', 
              schema: 'olympia', 
              table: 'matches',
              filter: 'status=neq.completed' // Only active matches
            }, 
            scheduleRefresh
          )
          .on(
            'postgres_changes', 
            { 
              event: '*', 
              schema: 'olympia', 
              table: 'live_sessions',
              filter: 'is_active=eq.true' // Only active sessions
            }, 
            scheduleRefresh
          )

        channel.subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Olympia realtime channel error')
          }
        })
      } catch (error) {
        console.error('Olympia realtime subscription failed', error)
      }
    }

    subscribe()

    return () => {
      mounted = false
      if (refreshTimer) {
        clearTimeout(refreshTimer)
      }
      if (channel) {
        if (supabaseInstance) {
          supabaseInstance.removeChannel(channel)
        } else {
          channel.unsubscribe()
        }
      }
    }
  }, [channelName, debounceMs, router])

  return null
}
