"use client"

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'

export type ViolationStats = {
  classId: string
  className: string
  totalViolations: number
  totalPoints: number
}

export type UseViolationStatsResult = {
  data: ViolationStats[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch violation statistics (school-wide view)
 */
export function useViolationStats(): UseViolationStatsResult {
  const [data, setData] = useState<ViolationStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    setError(null)

    try {
      const supabase = await getSupabase()
      // Fetch all violation records with class info
      const { data: records, error: queryError } = await supabase
        .from('records')
        .select('class_id, score, classes(name)')
        .is('deleted_at', null)

      if (queryError) throw queryError

      // Aggregate by class
      const statsByClass = new Map<string, { name: string; count: number; total: number }>()

      for (const record of records || []) {
        const classId = record.class_id
        if (!classId) continue

        const classEntry = Array.isArray(record.classes) ? record.classes[0] : record.classes
        const className = classEntry?.name

        if (!statsByClass.has(classId)) {
          statsByClass.set(classId, { name: className || 'Unknown', count: 0, total: 0 })
        }

        const stat = statsByClass.get(classId)!
        stat.count += 1
        stat.total += record.score || 0
      }

      const stats: ViolationStats[] = Array.from(statsByClass.entries()).map(([classId, stat]) => ({
        classId,
        className: stat.name,
        totalViolations: stat.count,
        totalPoints: stat.total,
      }))

      setData(stats)
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error')
      setIsError(true)
      setError(errorObj)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: fetchStats,
  }
}
