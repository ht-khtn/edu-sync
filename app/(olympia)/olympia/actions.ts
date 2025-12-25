'use server'

import { createHash, randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ensureOlympiaAdminAccess } from '@/lib/olympia-access'
import { getServerAuthContext, getServerSupabase } from '@/lib/server-auth'

export type ActionState = {
  error?: string | null
  success?: string | null
}

function generateRoomPassword() {
  return randomBytes(3).toString('hex').toUpperCase()
}

function hashPassword(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

function isPasswordMatch(stored: string | null | undefined, provided: string) {
  if (!stored) return false
  const hashed = hashPassword(provided)
  return stored === hashed || stored === provided
}

const matchSchema = z.object({
  name: z.string().min(3, 'Tên trận tối thiểu 3 ký tự'),
  tournamentId: z.string().uuid().optional().or(z.literal('')).transform((val) => (val ? val : null)),
  scheduledAt: z.string().optional().transform((val) => (val ? new Date(val).toISOString() : null)),
})

const questionSchema = z.object({
  code: z.string().min(3, 'Mã câu hỏi tối thiểu 3 ký tự').max(16),
  category: z.string().optional().transform((val) => (val && val.trim().length > 0 ? val : null)),
  questionText: z.string().min(10, 'Nội dung câu hỏi quá ngắn'),
  answerText: z.string().min(1, 'Cần có đáp án'),
  note: z.string().optional().transform((val) => (val && val.trim().length > 0 ? val : null)),
})

const joinSchema = z.object({
  joinCode: z
    .string()
    .min(4, 'Mã tối thiểu 4 ký tự')
    .max(32, 'Mã tối đa 32 ký tự')
    .transform((val) => val.trim().toUpperCase()),
  playerPassword: z
    .string()
    .min(4, 'Mật khẩu tối thiểu 4 ký tự')
    .max(64, 'Mật khẩu quá dài')
    .transform((val) => val.trim()),
})

const mcPasswordSchema = z.object({
  matchId: z.string().uuid('Trận không hợp lệ.'),
  mcPassword: z
    .string()
    .min(4, 'Mật khẩu tối thiểu 4 ký tự')
    .max(64, 'Mật khẩu quá dài')
    .transform((val) => val.trim()),
})

const matchIdSchema = z.object({
  matchId: z.string().uuid('Trận không hợp lệ.'),
})

const roundControlSchema = z.object({
  matchId: z.string().uuid('Trận không hợp lệ.'),
  roundType: z.enum(['khoi_dong', 'vcnv', 'tang_toc', 've_dich']),
})

const questionStateSchema = z.object({
  matchId: z.string().uuid('Trận không hợp lệ.'),
  questionState: z.enum(['hidden', 'showing', 'answer_revealed', 'completed']),
})

const submitAnswerSchema = z.object({
  sessionId: z.string().uuid('Phòng thi không hợp lệ.'),
  answer: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, 'Vui lòng nhập đáp án.'),
  notes: z
    .string()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : null)),
})

const buzzerSchema = z.object({
  sessionId: z.string().uuid('Phòng thi không hợp lệ.'),
})

function generateJoinCode() {
  return `OLY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export async function createMatchAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase, appUserId } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')
    if (!appUserId) return { error: 'Không tìm thấy thông tin người dùng.' }

    const parsed = matchSchema.safeParse({
      name: formData.get('name'),
      tournamentId: formData.get('tournamentId'),
      scheduledAt: formData.get('scheduledAt'),
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
    }

    const payload = parsed.data
    const { error } = await olympia.from('matches').insert({
      name: payload.name,
      tournament_id: payload.tournamentId,
      scheduled_at: payload.scheduledAt,
      status: 'draft',
      host_user_id: appUserId,
    })

    if (error) return { error: error.message }

    revalidatePath('/olympia/admin/matches')
    revalidatePath('/olympia/admin')
    return { success: 'Đã tạo trận mới.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể tạo trận.' }
  }
}

export async function createQuestionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase, appUserId } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')
    const parsed = questionSchema.safeParse({
      code: formData.get('code'),
      category: formData.get('category'),
      questionText: formData.get('questionText'),
      answerText: formData.get('answerText'),
      note: formData.get('note'),
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu câu hỏi không hợp lệ.' }
    }

    const payload = parsed.data
    const { error } = await olympia.from('questions').insert({
      code: payload.code.toUpperCase(),
      category: payload.category,
      question_text: payload.questionText,
      answer_text: payload.answerText,
      note: payload.note,
      created_by: appUserId,
      submitted_by: appUserId ?? 'unknown',
    })

    if (error) return { error: error.message }

    revalidatePath('/olympia/admin/question-bank')
    return { success: 'Đã thêm câu hỏi.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể tạo câu hỏi.' }
  }
}

export async function lookupJoinCodeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { authUid } = await getServerAuthContext()
    if (!authUid) return { error: 'Bạn cần đăng nhập để tham gia phòng.' }

    const parsed = joinSchema.safeParse({
      joinCode: formData.get('joinCode'),
      playerPassword: formData.get('playerPassword'),
    })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Mã tham gia không hợp lệ.' }
    }

    const supabase = await getServerSupabase()
    const olympia = supabase.schema('olympia')
    const { data, error } = await olympia
      .from('live_sessions')
      .select('id, status, match_id, question_state, current_round_type, player_password, requires_player_password')
      .eq('join_code', parsed.data.joinCode)
      .maybeSingle()

    if (error) return { error: error.message }
    if (!data) return { error: 'Không tìm thấy phòng với mã này.' }
    if (data.status !== 'running') return { error: 'Phòng chưa mở cho khán giả.' }

    const requiresPassword = data.requires_player_password !== false
    if (requiresPassword) {
      if (!parsed.data.playerPassword) {
        return { error: 'Phòng yêu cầu mật khẩu thí sinh.' }
      }
      if (!isPasswordMatch(data.player_password, parsed.data.playerPassword)) {
        return { error: 'Sai mật khẩu thí sinh.' }
      }
    }

    return {
      success: `Phòng đang chạy (round: ${data.current_round_type ?? 'N/A'}, trạng thái: ${data.question_state}).` as const,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể kiểm tra mã tham gia.' }
  }
}

export async function verifyMcPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = mcPasswordSchema.safeParse({
      matchId: formData.get('matchId'),
      mcPassword: formData.get('mcPassword'),
    })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Mật khẩu không hợp lệ.' }
    }

    const supabase = await getServerSupabase()
    const olympia = supabase.schema('olympia')
    const { data: session, error } = await olympia
      .from('live_sessions')
      .select('mc_view_password, status')
      .eq('match_id', parsed.data.matchId)
      .maybeSingle()

    if (error) return { error: error.message }
    if (!session) return { error: 'Trận này chưa có phòng live.' }

    if (!session.mc_view_password) {
      return { error: 'Phòng chưa cấu hình mật khẩu MC.' }
    }

    if (!isPasswordMatch(session.mc_view_password, parsed.data.mcPassword)) {
      return { error: 'Sai mật khẩu MC.' }
    }

    if (session.status !== 'running') {
      return { success: 'Mật khẩu đúng, nhưng phòng chưa chạy. Bạn vẫn có thể xem chế độ chuẩn bị.' }
    }

    return { success: 'Đã mở khóa chế độ xem MC.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể xác thực mật khẩu MC.' }
  }
}

export async function openLiveSessionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase, appUserId } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')
    const parsed = matchIdSchema.safeParse({ matchId: formData.get('matchId') })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Thiếu thông tin trận.' }
    }

    const matchId = parsed.data.matchId
    const { data: match, error: matchError } = await olympia
      .from('matches')
      .select('id, status')
      .eq('id', matchId)
      .maybeSingle()
    if (matchError) return { error: matchError.message }
    if (!match) return { error: 'Không tìm thấy trận.' }

    const { data: session, error: sessionError } = await olympia
      .from('live_sessions')
      .select('id, join_code, status')
      .eq('match_id', matchId)
      .maybeSingle()
    if (sessionError) return { error: sessionError.message }

    const joinCode = session?.join_code ?? generateJoinCode()
    const playerPasswordPlain = generateRoomPassword()
    const mcPasswordPlain = generateRoomPassword()
    const hashedPlayerPassword = hashPassword(playerPasswordPlain)
    const hashedMcPassword = hashPassword(mcPasswordPlain)

    if (!session) {
      const { error } = await olympia.from('live_sessions').insert({
        match_id: matchId,
        join_code: joinCode,
        status: 'running',
        created_by: appUserId,
        player_password: hashedPlayerPassword,
        mc_view_password: hashedMcPassword,
        requires_player_password: true,
      })
      if (error) return { error: error.message }
    } else {
      const { error } = await olympia
        .from('live_sessions')
        .update({
          status: 'running',
          join_code: joinCode,
          question_state: 'hidden',
          current_round_id: null,
          current_round_question_id: null,
          timer_deadline: null,
          ended_at: null,
          player_password: hashedPlayerPassword,
          mc_view_password: hashedMcPassword,
          requires_player_password: true,
        })
        .eq('id', session.id)
      if (error) return { error: error.message }
    }

    if (match.status !== 'live') {
      const { error } = await olympia.from('matches').update({ status: 'live' }).eq('id', matchId)
      if (error) return { error: error.message }
    }

    revalidatePath('/olympia/admin/matches')
    revalidatePath('/olympia/admin')
    revalidatePath('/olympia/client')

    return {
      success: `Đã mở phòng. Mã tham gia: ${joinCode}. Mật khẩu thí sinh: ${playerPasswordPlain}. Mật khẩu MC: ${mcPasswordPlain}.`,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể mở phòng thi.' }
  }
}

export async function endLiveSessionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')
    const parsed = matchIdSchema.safeParse({ matchId: formData.get('matchId') })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Thiếu thông tin trận.' }
    }

    const matchId = parsed.data.matchId
    const { data: session, error: sessionError } = await olympia
      .from('live_sessions')
      .select('id, status')
      .eq('match_id', matchId)
      .maybeSingle()
    if (sessionError) return { error: sessionError.message }
    if (!session) return { error: 'Trận này chưa có phòng live.' }
    if (session.status === 'ended') {
      return { error: 'Phòng đã kết thúc trước đó.' }
    }

    const endedAt = new Date().toISOString()

    const [{ error: liveError }, { error: matchError }] = await Promise.all([
      olympia
        .from('live_sessions')
        .update({ status: 'ended', ended_at: endedAt })
        .eq('id', session.id),
      olympia
        .from('matches')
        .update({ status: 'finished' })
        .eq('id', matchId),
    ])

    if (liveError) return { error: liveError.message }
    if (matchError) return { error: matchError.message }

    revalidatePath('/olympia/admin/matches')
    revalidatePath('/olympia/admin')
    revalidatePath('/olympia/client')

    return { success: 'Đã kết thúc phòng thi.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể kết thúc phòng thi.' }
  }
}

export async function setLiveSessionRoundAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')
    const parsed = roundControlSchema.safeParse({
      matchId: formData.get('matchId'),
      roundType: formData.get('roundType'),
    })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Thiếu thông tin vòng.' }
    }

    const { matchId, roundType } = parsed.data
    const { data: session, error: sessionError } = await olympia
      .from('live_sessions')
      .select('id, status')
      .eq('match_id', matchId)
      .maybeSingle()
    if (sessionError) return { error: sessionError.message }
    if (!session) return { error: 'Trận chưa mở phòng live.' }
    if (session.status !== 'running') {
      return { error: 'Phòng chưa ở trạng thái running.' }
    }

    const { data: roundRow, error: roundError } = await olympia
      .from('match_rounds')
      .select('id')
      .eq('match_id', matchId)
      .eq('round_type', roundType)
      .maybeSingle()
    if (roundError) return { error: roundError.message }
    if (!roundRow) return { error: 'Trận chưa cấu hình vòng này.' }

    const { error } = await olympia
      .from('live_sessions')
      .update({
        current_round_id: roundRow.id,
        current_round_type: roundType,
        question_state: 'hidden',
      })
      .eq('id', session.id)

    if (error) return { error: error.message }

    revalidatePath('/olympia/admin/matches')
    revalidatePath(`/olympia/admin/matches/${matchId}`)
    revalidatePath(`/olympia/admin/matches/${matchId}/host`)
    revalidatePath('/olympia/client')

    return { success: `Đã chuyển sang vòng ${roundType}.` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể đổi vòng.' }
  }
}

export async function setQuestionStateAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')
    const parsed = questionStateSchema.safeParse({
      matchId: formData.get('matchId'),
      questionState: formData.get('questionState'),
    })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Thiếu thông tin trạng thái.' }
    }

    const { matchId, questionState } = parsed.data
    const { data: session, error: sessionError } = await olympia
      .from('live_sessions')
      .select('id, status')
      .eq('match_id', matchId)
      .maybeSingle()
    if (sessionError) return { error: sessionError.message }
    if (!session) return { error: 'Trận chưa mở phòng live.' }

    const { error } = await olympia
      .from('live_sessions')
      .update({ question_state: questionState })
      .eq('id', session.id)

    if (error) return { error: error.message }

    revalidatePath('/olympia/admin/matches')
    revalidatePath(`/olympia/admin/matches/${matchId}`)
    revalidatePath(`/olympia/admin/matches/${matchId}/host`)
    revalidatePath('/olympia/client')

    return { success: `Đã cập nhật trạng thái câu hỏi: ${questionState}.` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.' }
  }
}

export async function submitAnswerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, authUid, appUserId } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')
    if (!authUid || !appUserId) {
      return { error: 'Bạn cần đăng nhập để gửi đáp án.' }
    }

    const parsed = submitAnswerSchema.safeParse({
      sessionId: formData.get('sessionId'),
      answer: formData.get('answer'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
    }

    const sessionId = parsed.data.sessionId
    const { data: session, error } = await olympia
      .from('live_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .maybeSingle()

    if (error) return { error: error.message }
    if (!session) return { error: 'Không tìm thấy phòng thi.' }
    if (session.status !== 'running') {
      return { error: 'Phòng chưa mở nhận đáp án.' }
    }

    // TODO: persist payload vào `olympia.answers` và kích hoạt service chấm điểm.
    console.info('[Olympia] submitAnswerAction stub', {
      responder: appUserId,
      sessionId,
      answer: parsed.data.answer,
      notes: parsed.data.notes,
    })

    return {
      success: 'Hệ thống đã nhận được đáp án (stub). Tính năng chấm điểm sẽ bật trong bản cập nhật kế tiếp.',
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể gửi đáp án ngay lúc này.' }
  }
}

export async function triggerBuzzerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, authUid, appUserId } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')
    if (!authUid || !appUserId) {
      return { error: 'Bạn cần đăng nhập để bấm chuông.' }
    }

    const parsed = buzzerSchema.safeParse({ sessionId: formData.get('sessionId') })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Mã phòng không hợp lệ.' }
    }

    const { data: session, error } = await olympia
      .from('live_sessions')
      .select('id, status, match_id')
      .eq('id', parsed.data.sessionId)
      .maybeSingle()

    if (error) return { error: error.message }
    if (!session) return { error: 'Không tìm thấy phòng thi.' }
    if (session.status !== 'running') {
      return { error: 'Phòng chưa sẵn sàng nhận tín hiệu buzzer.' }
    }

    // TODO: ghi nhận buzzer event (ưu tiên Supabase Realtime cho vòng VCNV).
    console.info('[Olympia] triggerBuzzerAction stub', {
      responder: appUserId,
      sessionId: parsed.data.sessionId,
      matchId: session.match_id,
    })

    return {
      success: 'Đã gửi tín hiệu buzzer (stub). Host sẽ xác nhận khi tính năng hoàn tất.',
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể gửi tín hiệu buzzer.' }
  }
}

const participantSchema = z.object({
  userId: z.string().uuid('User ID không hợp lệ.'),
  role: z.enum(['contestant', 'AD', 'MOD']).optional().transform((val) => (val === 'contestant' ? null : val)),
  contestantCode: z.string().optional().transform((val) => (val && val.trim().length > 0 ? val.trim().toUpperCase() : null)),
})

const updateParticipantSchema = z.object({
  userId: z.string().uuid('User ID không hợp lệ.'),
  role: z.enum(['contestant', 'AD', 'MOD']).optional().transform((val) => (val === 'contestant' ? null : val)),
  contestantCode: z.string().optional().transform((val) => (val && val.trim().length > 0 ? val.trim().toUpperCase() : null)),
})

const tournamentSchema = z.object({
  name: z.string().min(3, 'Tên giải tối thiểu 3 ký tự'),
  startsAt: z.string().optional().transform((val) => (val ? new Date(val).toISOString() : null)),
  endsAt: z.string().optional().transform((val) => (val ? new Date(val).toISOString() : null)),
  status: z.enum(['planned', 'active', 'archived']).optional().transform((val) => val ?? 'planned'),
})

export async function createParticipantAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')

    const parsed = participantSchema.safeParse({
      userId: formData.get('userId'),
      role: formData.get('role'),
      contestantCode: formData.get('contestantCode'),
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
    }

    const { userId, role, contestantCode } = parsed.data

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (userError) return { error: userError.message }
    if (!user) return { error: 'User ID không tồn tại trong hệ thống.' }

    // Check if already exists
    const { data: existing } = await olympia
      .from('participants')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) return { error: 'Tài khoản này đã được đăng ký Olympia.' }

    const { error } = await olympia.from('participants').insert({
      user_id: userId,
      role: role,
      contestant_code: contestantCode,
    })

    if (error) return { error: error.message }

    revalidatePath('/olympia/admin/accounts')
    revalidatePath('/olympia/admin')
    return { success: 'Đã thêm tài khoản Olympia thành công.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể tạo tài khoản.' }
  }
}

export async function updateParticipantAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')

    const parsed = updateParticipantSchema.safeParse({
      userId: formData.get('userId'),
      role: formData.get('role'),
      contestantCode: formData.get('contestantCode'),
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
    }

    const { userId, role, contestantCode } = parsed.data

    const { error } = await olympia
      .from('participants')
      .update({
        role: role,
        contestant_code: contestantCode,
      })
      .eq('user_id', userId)

    if (error) return { error: error.message }

    revalidatePath('/olympia/admin/accounts')
    revalidatePath('/olympia/admin')
    return { success: 'Đã cập nhật tài khoản thành công.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể cập nhật tài khoản.' }
  }
}

export async function deleteParticipantAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')

    const userId = formData.get('userId') as string

    if (!userId || !userId.match(/^[0-9a-f\-]+$/i)) {
      return { error: 'User ID không hợp lệ.' }
    }

    const { error } = await olympia
      .from('participants')
      .delete()
      .eq('user_id', userId)

    if (error) return { error: error.message }

    revalidatePath('/olympia/admin/accounts')
    revalidatePath('/olympia/admin')
    return { success: 'Đã xóa tài khoản thành công.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể xóa tài khoản.' }
  }
}

export async function createTournamentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')

    const parsed = tournamentSchema.safeParse({
      name: formData.get('name'),
      startsAt: formData.get('startsAt'),
      endsAt: formData.get('endsAt'),
      status: formData.get('status'),
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
    }

    const { name, startsAt, endsAt, status } = parsed.data

    const { error } = await olympia.from('tournaments').insert({
      name: name,
      starts_at: startsAt,
      ends_at: endsAt,
      status: status,
    })

    if (error) return { error: error.message }

    revalidatePath('/olympia/admin/matches')
    revalidatePath('/olympia/admin')
    return { success: 'Đã tạo giải đấu mới.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể tạo giải đấu.' }
  }
}

export async function updateTournamentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')

    const parsed = z.object({
      tournamentId: z.string().uuid('ID giải không hợp lệ.'),
      name: z.string().min(3, 'Tên giải tối thiểu 3 ký tự'),
      startsAt: z.string().optional().transform((val) => (val ? new Date(val).toISOString() : null)),
      endsAt: z.string().optional().transform((val) => (val ? new Date(val).toISOString() : null)),
      status: z.enum(['planned', 'active', 'archived']).optional(),
    }).safeParse({
      tournamentId: formData.get('tournamentId'),
      name: formData.get('name'),
      startsAt: formData.get('startsAt'),
      endsAt: formData.get('endsAt'),
      status: formData.get('status'),
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
    }

    const { tournamentId, name, startsAt, endsAt, status } = parsed.data

    const { error } = await olympia
      .from('tournaments')
      .update({
        name: name,
        starts_at: startsAt,
        ends_at: endsAt,
        status: status,
      })
      .eq('id', tournamentId)

    if (error) return { error: error.message }

    revalidatePath('/olympia/admin/matches')
    revalidatePath('/olympia/admin')
    return { success: 'Đã cập nhật giải đấu thành công.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể cập nhật giải đấu.' }
  }
}

export async function updateMatchAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')

    const parsed = z.object({
      matchId: z.string().uuid('ID trận không hợp lệ.'),
      name: z.string().min(3, 'Tên trận tối thiểu 3 ký tự'),
      tournamentId: z.string().uuid().optional().or(z.literal('')).transform((val) => (val ? val : null)),
      scheduledAt: z.string().optional().transform((val) => (val ? new Date(val).toISOString() : null)),
      status: z.enum(['draft', 'scheduled', 'live', 'finished', 'cancelled']).optional(),
    }).safeParse({
      matchId: formData.get('matchId'),
      name: formData.get('name'),
      tournamentId: formData.get('tournamentId'),
      scheduledAt: formData.get('scheduledAt'),
      status: formData.get('status'),
    })

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
    }

    const { matchId, name, tournamentId, scheduledAt, status } = parsed.data

    const { error } = await olympia
      .from('matches')
      .update({
        name: name,
        tournament_id: tournamentId,
        scheduled_at: scheduledAt,
        status: status,
      })
      .eq('id', matchId)

    if (error) return { error: error.message }

    revalidatePath('/olympia/admin/matches')
    revalidatePath('/olympia/admin')
    return { success: 'Đã cập nhật trận thành công.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể cập nhật trận.' }
  }
}
const createMatchRoundsSchema = z.object({
  matchId: z.string().uuid('Mã trận không hợp lệ.'),
})

export async function createMatchRoundsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess()
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')

    const parsed = createMatchRoundsSchema.safeParse({ matchId: formData.get('matchId') })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Thiếu thông tin trận.' }
    }

    const matchId = parsed.data.matchId

    // Check if match exists
    const { data: match, error: matchError } = await olympia
      .from('matches')
      .select('id')
      .eq('id', matchId)
      .maybeSingle()
    if (matchError) return { error: matchError.message }
    if (!match) return { error: 'Không tìm thấy trận.' }

    // Check if rounds already exist
    const { data: existingRounds, error: checkError } = await olympia
      .from('match_rounds')
      .select('id')
      .eq('match_id', matchId)
    if (checkError) return { error: checkError.message }

    if (existingRounds && existingRounds.length > 0) {
      return { error: 'Trận này đã có các vòng thi.' }
    }

    // Create default rounds
    const roundTypes = [
      { roundType: 'khoi_dong', orderIndex: 0 },
      { roundType: 'vcnv', orderIndex: 1 },
      { roundType: 'tang_toc', orderIndex: 2 },
      { roundType: 've_dich', orderIndex: 3 },
    ]

    const { error: insertError } = await olympia.from('match_rounds').insert(
      roundTypes.map((round) => ({
        match_id: matchId,
        round_type: round.roundType,
        order_index: round.orderIndex,
        config: {},
      }))
    )

    if (insertError) return { error: insertError.message }

    revalidatePath(`/olympia/admin/matches/${matchId}`)
    revalidatePath(`/olympia/admin/matches/${matchId}/host`)
    return { success: 'Đã tạo 4 vòng thi mặc định (Khởi động, Vượt chướng, Tăng tốc, Về đích).' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Không thể tạo vòng thi.' }
  }
}