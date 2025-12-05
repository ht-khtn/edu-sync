import { cache } from 'react'
import { getServerAuthContext } from '@/lib/server-auth'

export type OlympiaParticipant = {
  user_id: string
  contestant_code: string | null
  role: string | null
}

export type OlympiaRoleSummary = 'olympia-admin' | 'olympia-player' | 'olympia-mc' | 'olympia-guest'

export const getOlympiaParticipant = cache(async (): Promise<OlympiaParticipant | null> => {
  const { supabase, appUserId } = await getServerAuthContext()
  if (!appUserId) return null

  const olympia = supabase.schema('olympia')
  const { data, error } = await olympia
    .from('participants')
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

export async function summarizeOlympiaRole(): Promise<OlympiaRoleSummary> {
  const participant = await getOlympiaParticipant()
  if (!participant) return 'olympia-guest'

  if (participant.role === 'AD') return 'olympia-admin'
  if (participant.role === 'MC') return 'olympia-mc'
  if (participant.contestant_code) return 'olympia-player'
  return 'olympia-guest'
}
