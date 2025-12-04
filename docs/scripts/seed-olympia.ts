import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
})
const olympia = supabase.schema('olympia')

const tournamentId = '00000000-0000-4000-8000-000000000111'
const upcomingMatchId = '00000000-0000-4000-8000-000000000222'
const liveMatchId = '00000000-0000-4000-8000-000000000333'
const liveSessionId = '00000000-0000-4000-8000-000000000444'

const questions = [
  { id: '00000000-0000-4000-8000-000000100001', code: 'OLY-001', category: 'Khởi động', question_text: 'Số nguyên tố nhỏ nhất lớn hơn 90 là bao nhiêu?', answer_text: '97', note: 'Cơ bản', submitted_by: 'Auto seed' },
  { id: '00000000-0000-4000-8000-000000100002', code: 'OLY-002', category: 'Văn hóa', question_text: 'Ai là tác giả Truyện Kiều?', answer_text: 'Nguyễn Du', note: null, submitted_by: 'Auto seed' },
  { id: '00000000-0000-4000-8000-000000100003', code: 'OLY-003', category: 'Lịch sử', question_text: 'Chiến thắng Điện Biên Phủ diễn ra năm nào?', answer_text: '1954', note: null, submitted_by: 'Auto seed' },
  { id: '00000000-0000-4000-8000-000000100004', code: 'OLY-004', category: 'Tiếng Anh', question_text: 'Dịch sang tiếng Việt: sustainability', answer_text: 'Bền vững', note: 'Vocabulary', submitted_by: 'Auto seed' },
  { id: '00000000-0000-4000-8000-000000100005', code: 'OLY-005', category: 'Vật lý', question_text: 'Đơn vị của công suất là gì?', answer_text: 'Watt', note: null, submitted_by: 'Auto seed' },
]

async function seed() {
  console.log('Seeding olympia schema...')

  const { error: tournamentError } = await olympia.from('tournaments').upsert(
    [
      {
        id: tournamentId,
        name: 'Olympia Mùa Đông 2025',
        description: 'Chuỗi thi đấu nội bộ chuẩn bị cho VTV Olympia',
        starts_at: new Date().toISOString(),
        ends_at: null,
        status: 'active',
      },
    ],
    { onConflict: 'id' }
  )
  if (tournamentError) throw tournamentError

  const { error: matchesError } = await olympia.from('matches').upsert(
    [
      {
        id: upcomingMatchId,
        tournament_id: tournamentId,
        name: 'Tuần 05 - Khởi động',
        scheduled_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
        status: 'scheduled',
        metadata: { location: 'Phòng Studio 1' },
      },
      {
        id: liveMatchId,
        tournament_id: tournamentId,
        name: 'Tuần 04 - Đang diễn ra',
        scheduled_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        status: 'live',
        metadata: { location: 'Phòng Studio 2' },
      },
    ],
    { onConflict: 'id' }
  )
  if (matchesError) throw matchesError

  const { error: questionsError } = await olympia.from('questions').upsert(questions, { onConflict: 'id' })
  if (questionsError) throw questionsError

  const { error: liveSessionError } = await olympia.from('live_sessions').upsert(
    [
      {
        id: liveSessionId,
        match_id: liveMatchId,
        join_code: 'OLY-2025',
        status: 'running',
        question_state: 'showing',
        current_round_type: 'khoi_dong',
      },
    ],
    { onConflict: 'id' }
  )
  if (liveSessionError) throw liveSessionError

  console.log('Seed completed successfully')
}

seed().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
