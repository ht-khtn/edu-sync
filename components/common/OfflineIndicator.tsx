"use client"

import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'

type DisplayMode = 'offline' | 'reconnected' | 'hidden'

/**
 * Global offline indicator banner
 * Shows when user loses internet connection
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus()
  const [mode, setMode] = useState<DisplayMode>('hidden')
  const wasOfflineRef = useRef(false)
  const prevIsOnlineRef = useRef(isOnline)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const prevOnline = prevIsOnlineRef.current
    prevIsOnlineRef.current = isOnline

    // Only update state when online status actually changes
    if (prevOnline === isOnline) return

    const scheduleMode = (next: DisplayMode) => {
      if (typeof window === 'undefined') {
        setMode(next)
        return
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = window.requestAnimationFrame(() => {
        setMode(next)
        rafRef.current = null
      })
    }

    if (!isOnline) {
      // Going offline
      wasOfflineRef.current = true
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      scheduleMode('offline')
    } else if (wasOfflineRef.current) {
      // Just reconnected
      scheduleMode('reconnected')
      timerRef.current = setTimeout(() => {
        scheduleMode('hidden')
        wasOfflineRef.current = false
        timerRef.current = null
      }, 3000)
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isOnline])

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  if (mode === 'hidden') {
    return null
  }

  if (mode === 'reconnected') {
    return (
      <div className="sticky top-0 z-50 w-full animate-in slide-in-from-top">
        <Alert className="rounded-none border-x-0 border-t-0 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100">
          <Wifi className="h-4 w-4" />
          <AlertDescription>
            Đã kết nối lại Internet
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="sticky top-0 z-50 w-full animate-in slide-in-from-top">
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <WifiOff className="h-4 w-4" />
        <AlertDescription className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>Không có kết nối Internet. Một số tính năng có thể không khả dụng.</span>
        </AlertDescription>
      </Alert>
    </div>
  )
}
