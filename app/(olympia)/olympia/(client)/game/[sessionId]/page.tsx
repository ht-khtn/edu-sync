import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OlympiaGameClient } from '@/components/olympia/game'
import { getServerAuthContext } from '@/lib/server-auth'
import type { GameSessionPayload } from '@/types/olympia/game'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: {
    sessionId: string
  }
}

async function getGameSessionData(supabase: SupabaseClient, sessionId: string): Promise<GameSessionPayload | null> {
  const olympia = supabase.schema('olympia')
  const { data: session, error: sessionError } = await olympia
    .from('live_sessions')
    .select(
      'id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline'
    )
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError) {
    console.error('[Olympia] load live session failed', sessionError.message)
    return null
  }

  if (!session) return null

  const [{ data: match, error: matchError }, { data: players, error: playersError }] = await Promise.all([
    olympia
      .from('matches')
      .select('id, name, status, scheduled_at')
      .eq('id', session.match_id)
      .maybeSingle(),
    olympia
      .from('match_players')
      .select('id, player_id, display_name, seat_number, class_name, school_name, user_id')
      .eq('match_id', session.match_id)
      .order('seat_number', { ascending: true }),
  ])

  if (matchError) {
    console.error('[Olympia] load match failed', matchError.message)
    return null
  }

  if (!match) return null

  if (playersError) {
    console.warn('[Olympia] load players failed', playersError.message)
  }

  const [{ data: scores }, { data: roundQuestions }] = await Promise.all([
    olympia
      .from('match_scores')
      .select('id, match_id, player_id, round_type, total_score')
      .eq('match_id', session.match_id),
    olympia
      .from('round_questions')
      .select('id, match_id, round_id, round_type, sequence, question_id, target_player_id')
      .eq('match_id', session.match_id)
      .order('sequence', { ascending: true }),
  ])

  return {
    session,
    match,
    players: players ?? [],
    scores: scores ?? [],
    roundQuestions: roundQuestions ?? [],
    buzzerEvents: [], // TODO: hydrate from `olympia.buzzer_events` once data is available
    serverTimestamp: new Date().toISOString(),
    viewerUserId: null,
  }
}

const statusLabel: Record<string, string> = {
  running: 'Đang mở',
  pending: 'Chờ mở',
  ended: 'Đã kết thúc',
}

export default async function OlympiaGamePage({ params }: PageProps) {
  const { supabase, authUid, appUserId } = await getServerAuthContext()
  const sessionId = params.sessionId
  if (!sessionId) {
    notFound()
  }

  const data = await getGameSessionData(supabase, sessionId)
  if (!data) {
    notFound()
  }

  const viewerId = appUserId ?? null
  const sessionStatus = data.session.status
  const sessionIsRunning = sessionStatus === 'running'

  return (
    <div className="space-y-6">
      {!authUid ? (
        <Alert>
          <AlertTitle>Yêu cầu đăng nhập</AlertTitle>
          <AlertDescription>Vui lòng đăng nhập để đồng bộ tiến trình thi và gửi đáp án.</AlertDescription>
        </Alert>
      ) : null}

      {!sessionIsRunning ? (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTitle>Phòng chưa mở</AlertTitle>
          <AlertDescription>
            Trạng thái hiện tại: {statusLabel[sessionStatus] ?? sessionStatus}. Bạn có thể ở lại trang này, hệ thống sẽ cập nhật ngay khi host mở
            câu hỏi.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
            <span>{data.match.name}</span>
            <Badge variant={sessionIsRunning ? 'default' : 'secondary'}>
              {statusLabel[sessionStatus] ?? sessionStatus}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Mã tham gia: <span className="font-mono text-base text-slate-900">{data.session.join_code}</span></p>
          <p>
            Vòng hiện tại: <strong>{data.session.current_round_type ?? '—'}</strong> · Trạng thái câu hỏi:{' '}
            <strong>{data.session.question_state ?? '—'}</strong>
          </p>
        </CardContent>
      </Card>

      <OlympiaGameClient
        initialData={{ ...data, viewerUserId: viewerId }}
        sessionId={sessionId}
        allowGuestFallback={!authUid}
      />
    </div>
  )
}
