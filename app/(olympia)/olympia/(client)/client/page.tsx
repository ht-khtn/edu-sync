import { JoinSessionForm } from '@/components/domain/olympia/JoinSessionForm'
import { LiveScheduleAutoRefresh } from '@/components/domain/olympia/LiveScheduleAutoRefresh'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getServerSupabase } from '@/lib/server-auth'
import { cache } from 'react'

export const dynamic = 'force-dynamic'

type MatchRow = {
  id: string
  name: string
  status: string
  scheduled_at: string | null
}

type LiveSessionRow = {
  id: string
  match_id: string
  join_code: string
  status: string
  question_state: string
  current_round_type: string | null
}

const formatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeStyle: 'short' })
const matchStatusLabel: Record<string, string> = {
  scheduled: 'Đã lên lịch',
  live: 'Đang diễn ra',
  finished: 'Đã kết thúc',
}

const fetchUpcomingMatches = cache(async () => {
  const supabase = await getServerSupabase()
  const { data: matches, error } = await supabase
    .from('olympia.matches')
    .select('id, name, status, scheduled_at')
    .in('status', ['scheduled', 'live'])
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(6)

  if (error) throw error
  const rows = matches ?? []
  if (rows.length === 0) return { matches: [], sessions: [] }

  const { data: sessions } = await supabase
    .from('olympia.live_sessions')
    .select('id, match_id, join_code, status, question_state, current_round_type')
    .in(
      'match_id',
      rows.map((m) => m.id)
    )

  return { matches: rows, sessions: sessions ?? [] }
})

export default async function OlympiaClientHomePage() {
  const { matches, sessions } = await fetchUpcomingMatches()
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

      <LiveScheduleAutoRefresh intervalMs={45000} />
    </section>
  )
}
