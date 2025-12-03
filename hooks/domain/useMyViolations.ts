"use client"

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'

export type ViolationRecord = {
  id: string
  created_at: string
  score: number
  note: string | null
  criteria: {
    id: string
    name: string
  } | null
  classes: {
    id: string
    name: string
  } | null
}

export type UseMyViolationsResult = {
  data: ViolationRecord[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch current user's violations
 */
export function useMyViolations(userId: string | null): UseMyViolationsResult {
  const [data, setData] = useState<ViolationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchViolations = useCallback(async () => {
    if (!userId) {
      setData([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setIsError(false)
    setError(null)

    try {
      const supabase = await getSupabase()
      const { data: rows, error: queryError } = await supabase
        .from('records')
        .select('id, created_at, score, note, criteria(id,name), classes(id,name)')
        .eq('student_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(300)

      if (queryError) throw queryError

      const violations = (rows || []).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        score: r.score,
        note: r.note,
        criteria: Array.isArray(r.criteria) ? r.criteria[0] : r.criteria,
        classes: Array.isArray(r.classes) ? r.classes[0] : r.classes,
      })) as ViolationRecord[]

      setData(violations)
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error')
      setIsError(true)
      setError(errorObj)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchViolations()
  }, [fetchViolations])

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: fetchViolations,
  }
}
