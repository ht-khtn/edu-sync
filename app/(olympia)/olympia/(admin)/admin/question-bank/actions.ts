'use server'

import { getServerAuthContext } from '@/lib/server-auth'

export type QuestionSetItem = {
  id: string
  code: string
  category: string | null
  question_text: string
  answer_text: string
  note: string | null
  submitted_by: string | null
  source: string | null
  image_url: string | null
  audio_url: string | null
  order_index: number
}

export async function getQuestionSetItems(questionSetId: string): Promise<QuestionSetItem[]> {
  try {
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')
    
    const { data, error } = await olympia
      .from('question_set_items')
      .select('id, code, category, question_text, answer_text, note, submitted_by, source, image_url, audio_url, order_index')
      .eq('question_set_id', questionSetId)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('[getQuestionSetItems] Error:', error)
      return []
    }

    return data ?? []
  } catch (err) {
    console.error('[getQuestionSetItems] Exception:', err)
    return []
  }
}
