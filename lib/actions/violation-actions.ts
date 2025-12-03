'use server'

import { revalidatePath } from 'next/cache'
import getSupabaseServer from '@/lib/supabase-server'

export type CreateViolationInput = {
  student_id: string
  criteria_id: string
  class_id: string
  score: number
  note?: string
}

/**
 * Server action to create a violation record
 * Automatically revalidates related caches
 */
export async function createViolationAction(input: CreateViolationInput) {
  const supabase = await getSupabaseServer()

  const { data, error } = await supabase.from('records').insert([
    {
      student_id: input.student_id,
      criteria_id: input.criteria_id,
      class_id: input.class_id,
      score: input.score,
      note: input.note || null,
    },
  ]).select()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate related paths
  revalidatePath('/admin/violation-history')
  revalidatePath('/admin/violation-stats')
  revalidatePath('/admin/leaderboard')
  revalidatePath('/client/my-violations')

  return { success: true, data }
}

/**
 * Server action to update a violation record
 */
export async function updateViolationAction(
  recordId: string,
  updates: Partial<CreateViolationInput>
) {
  const supabase = await getSupabaseServer()

  const { data, error } = await supabase
    .from('records')
    .update(updates)
    .eq('id', recordId)
    .select()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate caches
  revalidatePath('/admin/violation-history')
  revalidatePath('/admin/violation-stats')
  revalidatePath('/admin/leaderboard')

  return { success: true, data }
}

/**
 * Server action to soft-delete a violation record
 */
export async function deleteViolationAction(recordId: string) {
  const supabase = await getSupabaseServer()

  const { error } = await supabase
    .from('records')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', recordId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate caches
  revalidatePath('/admin/violation-history')
  revalidatePath('/admin/violation-stats')
  revalidatePath('/admin/leaderboard')
  revalidatePath('/client/my-violations')

  return { success: true }
}
