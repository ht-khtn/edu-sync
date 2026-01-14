'use client'

import { useEffect } from 'react'

type OlympiaRealtimeListenerProps = {
  debounceMs?: number
}

export function OlympiaRealtimeListener({ debounceMs = 800 }: OlympiaRealtimeListenerProps = {}) {
  void debounceMs

  useEffect(() => {
    return () => {
      // no-op
    }
  }, [])

  return null
}
