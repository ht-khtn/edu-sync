"use client"

import { useEffect, useState, useCallback, useRef } from 'react'

export type SessionUser = {
  id: string
}

export type SessionInfo = {
  user: SessionUser | null
  hasCC?: boolean
  hasSchoolScope?: boolean
  hasOlympiaAccess?: boolean
  ccClassId?: string | null
  roles?: string[]
}

export type UseSessionResult = {
  data: SessionInfo | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const MIN_FETCH_INTERVAL = 3000 // ms

/**
 * Hook to get current session info from /api/session
 * Provides loading state, error handling, and refetch capability
 */
export function useSession(): UseSessionResult {
  const [data, setData] = useState<SessionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchingRef = useRef(false)
  const lastFetchAtRef = useRef(0)
  const hasDataRef = useRef(false)

  const fetchSession = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force) {
      if (fetchingRef.current) return
      if (now - lastFetchAtRef.current < MIN_FETCH_INTERVAL) return
    }

    fetchingRef.current = true
    lastFetchAtRef.current = now
    
    // Only show loading if we don't have data yet
    if (!hasDataRef.current) {
      setIsLoading(true)
    }
    setIsError(false)
    setError(null)

    try {
      const res = await fetch('/api/session', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`Session fetch failed: ${res.status}`)
      }
      const json = await res.json()
      setData(json)
      hasDataRef.current = true
      try {
        sessionStorage.setItem('session-cache', JSON.stringify(json))
      } catch {}
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error')
      setIsError(true)
      setError(errorObj)
      setData(null)
    } finally {
      setIsLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    // Hydrate from sessionStorage to avoid sidebar flash
    try {
      const cached = sessionStorage.getItem('session-cache')
      if (cached) {
        const parsed = JSON.parse(cached) as SessionInfo
        setData(parsed)
        hasDataRef.current = true
        setIsLoading(false)
      }
    } catch {}

    fetchSession(true)
  }, [fetchSession])

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: () => fetchSession(true),
  }
}
