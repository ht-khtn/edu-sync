import { JoinSessionForm } from '@/components/olympia/JoinSessionForm'
import { LiveScheduleAutoRefresh } from '@/components/olympia/LiveScheduleAutoRefresh'
import { OlympiaRealtimeListener } from '@/components/olympia/OlympiaRealtimeListener'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getServerAuthContext } from '@/lib/server-auth'
import { cache } from 'react'

// ISR: Match schedule updates every 30s. Real-time listener handles live updates.
export const revalidate = 30

const formatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeStyle: 'short' })
const matchStatusLabel: Record<string, string> = {
  scheduled: 'Đã lên lịch',
  live: 'Đang diễn ra',
  finished: 'Đã kết thúc',
}

type UpcomingMatchesPayload = {
  matches: Array<{ id: string; name: string; status: string; scheduled_at: string | null }>
  sessions: Array<{
    id: string
    match_id: string
    join_code: string
    status: string
    question_state: string | null
    current_round_type: string | null
  }>
  error?: string
}

const fetchUpcomingMatches = cache(async (): Promise<UpcomingMatchesPayload> => {
  const { supabase, authUid } = await getServerAuthContext()
  const olympia = supabase.schema('olympia')

  if (!authUid) {
    return {
      matches: [],
      sessions: [],
      error: 'Bạn cần đăng nhập để xem lịch thi Olympia.',
    }
  }
  const { data: matches, error } = await olympia
    .from('matches')
    .select('id, name, status, scheduled_at')
    .in('status', ['scheduled', 'live'])
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(6)

  if (error) {
    console.error('[Olympia] Không tải được danh sách trận:', error.message)
    return { matches: [], sessions: [], error: 'Không thể tải lịch thi. Vui lòng thử lại sau.' }
  }
  const rows = matches ?? []
  if (rows.length === 0) return { matches: [], sessions: [] }

  const { data: sessions } = await olympia
    .from('live_sessions')
    .select('id, match_id, join_code, status, question_state, current_round_type')
    .in(
      'match_id',
      rows.map((m) => m.id)
    )

  return { matches: rows, sessions: sessions ?? [] }
})

export default async function OlympiaClientHomePage() {
  const { matches, sessions, error } = await fetchUpcomingMatches()
  const sessionByMatch = new Map(sessions.map((session) => [session.match_id, session]))

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Lịch thi Olympia</h1>
        <p className="text-sm text-muted-foreground">
          Nhập mã tham gia do ban tổ chức cung cấp hoặc chọn trận đang mở để tham gia khán phòng trực tuyến.
        </p>
        <div className="flex flex-col gap-2 rounded-lg border bg-white p-4 shadow-sm">
          <JoinSessionForm />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải dữ liệu</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {matches.length === 0 ? (
        <Alert>
          <AlertTitle>Chưa có lịch thi</AlertTitle>
          <AlertDescription>
            Khi ban tổ chức chuyển trận sang trạng thái scheduled hoặc live, lịch thi sẽ hiển thị tại đây.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {matches.map((match) => {
            const session = sessionByMatch.get(match.id)
            return (
              <Card key={match.id} className="border border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 text-lg">
                    <span>{match.name}</span>
                    <Badge variant={match.status === 'live' ? 'default' : 'secondary'}>
                      {matchStatusLabel[match.status] ?? match.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {match.scheduled_at ? formatter.format(new Date(match.scheduled_at)) : 'Đang cập nhật lịch'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {match.status === 'live' && session ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <p className="text-xs font-semibold uppercase text-green-700">Đang mở phòng</p>
                      <p className="text-2xl font-mono tracking-wider text-green-800">{session.join_code}</p>
                      <p className="text-xs text-green-700">
                        Vòng hiện tại: {session.current_round_type ?? 'Đang cập nhật'} · Trạng thái: {session.question_state}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      Ban tổ chức sẽ gửi mã tham gia khi trận chuyển sang trạng thái live.
                    </p>
                  )}
                  <Button variant="outline" size="sm" disabled>
                    Đăng ký tham gia (sắp ra mắt)
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <OlympiaRealtimeListener debounceMs={1000} />
      <LiveScheduleAutoRefresh intervalMs={90000} />
    </section>
  )
}
