import { cache } from 'react'
import { getServerAuthContext } from '@/lib/server-auth'

export type OlympiaParticipant = {
  user_id: string
  contestant_code: string | null
  role: string | null
}

export const getOlympiaParticipant = cache(async (): Promise<OlympiaParticipant | null> => {
  const { supabase, appUserId } = await getServerAuthContext()
  if (!appUserId) return null

  const { data, error } = await supabase
    .from('olympia.participants')
    .select('user_id, contestant_code, role')
    .eq('user_id', appUserId)
    .maybeSingle()

  if (error || !data) return null
  return data as OlympiaParticipant
})

export async function ensureOlympiaAdminAccess() {
  const participant = await getOlympiaParticipant()
  if (!participant || participant.role !== 'AD') {
    throw new Error('FORBIDDEN_OLYMPIA_ADMIN')
  }
  return participant
}
