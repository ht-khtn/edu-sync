import { unstable_cache } from 'next/cache'
import { getSupabaseAdminServer } from '@/lib/supabase-admin-server'
import type { CachedRoundQuestionRow } from './types'

export async function getRoundQuestionsForMatchCached(matchId: string): Promise<CachedRoundQuestionRow[]> {
  // Lưu ý: `unstable_cache` cần key ổn định theo matchId.
  // Nếu key không bao gồm matchId, dữ liệu round_questions có thể bị dùng chung giữa các trận,
  // dẫn đến UI Về đích hiển thị "đã chốt gói" ngay trên trận mới.
  const cached = unstable_cache(
    async (): Promise<CachedRoundQuestionRow[]> => {
      const supabase = await getSupabaseAdminServer()
      const olympia = supabase.schema('olympia')
      const { data: rounds, error: roundsError } = await olympia
        .from('match_rounds')
        .select('id')
        .eq('match_id', matchId)
      if (roundsError) throw roundsError
      const roundIds = (rounds ?? []).map((r) => r.id)
      if (roundIds.length === 0) return []

      const { data: roundQuestions, error: rqError } = await olympia
        .from('round_questions')
        .select(
          'id, match_round_id, order_index, question_id, question_set_item_id, target_player_id, meta, question_text, answer_text, note, questions(image_url, audio_url), question_set_items(image_url, audio_url)'
        )
        .in('match_round_id', roundIds)
        .order('match_round_id', { ascending: true })
        .order('order_index', { ascending: true })
        .order('id', { ascending: true })
      if (rqError) throw rqError
      return (roundQuestions as unknown as CachedRoundQuestionRow[] | null) ?? []
    },
    ['olympia', 'host', 'round-questions-by-match', matchId],
    { revalidate: 15 }
  )

  return await cached()
}
