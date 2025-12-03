"use client"

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'

export type CreateViolationInput = {
  student_id: string
  criteria_id: string
  class_id: string
  score: number
  note?: string
}

export type UseCreateViolationResult = {
  createViolation: (input: CreateViolationInput) => Promise<void>
  isCreating: boolean
  isError: boolean
  error: Error | null
}

/**
 * Hook to create a new violation record
 */
export function useCreateViolation(): UseCreateViolationResult {
  const [isCreating, setIsCreating] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createViolation = async (input: CreateViolationInput) => {
    setIsCreating(true)
    setIsError(false)
    setError(null)

    try {
      const supabase = await getSupabase()
      const { error: insertError } = await supabase.from('records').insert([
        {
          student_id: input.student_id,
          criteria_id: input.criteria_id,
          class_id: input.class_id,
          score: input.score,
          note: input.note || null,
        },
      ])

      if (insertError) throw insertError
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error')
      setIsError(true)
      setError(errorObj)
      throw errorObj
    } finally {
      setIsCreating(false)
    }
  }

  return {
    createViolation,
    isCreating,
    isError,
    error,
  }
}
