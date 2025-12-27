import Link from 'next/link'
import { JoinQuickTabs } from '@/components/olympia/client/client/JoinQuickTabs'
import { LiveScheduleAutoRefresh } from '@/components/olympia/client/client/LiveScheduleAutoRefresh'
import { OlympiaRealtimeListener } from '@/components/olympia/shared/OlympiaRealtimeListener'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getServerAuthContext } from '@/lib/server-auth'
import { cache } from 'react'
import { Clock, Radio, Calendar } from 'lucide-react'
import { cn } from '@/utils/cn'

// ISR: Match schedule updates every 30s. Real-time listener handles live updates.
export const revalidate = 30

const formatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeStyle: 'short' })
const matchStatusLabel: Record<string, string> = {
  scheduled: 'Chưa diễn ra',
  live: 'Đang diễn ra',
  finished: 'Đã kết thúc',
}

const roundLabelMap: Record<string, string> = {
  khoi_dong: 'Khởi động',
  vcnv: 'Vượt chướng ngại vật',
  tang_toc: 'Tăng tốc',
  ve_dich: 'Về đích',
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
        <div>
          <h1 className="text-4xl font-bold tracking-tight">🎮 Olympia Quiz Live</h1>
          <p className="text-lg text-muted-foreground mt-2">
            Thi trắc nghiệm trực tuyến theo hình thức game show
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {/* Join Card */}
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">⚡ Tham gia nhanh</CardTitle>
              <CardDescription>Chọn vai trò (Thí sinh/MC/Khách) và nhập thông tin cần thiết</CardDescription>
            </CardHeader>
            <CardContent>
              <JoinQuickTabs />
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">❓ Cần giúp?</CardTitle>
              <CardDescription>Tìm hiểu cách tham gia</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/olympia/client/join">
                  Hướng dẫn →
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải dữ liệu</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div>
        <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Lịch thi sắp tới
        </h2>

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
              const isLive = match.status === 'live' && session?.status === 'running'
              const scheduledDate = match.scheduled_at ? new Date(match.scheduled_at) : null

              return (
                <Card key={match.id} className={cn('border-2 transition-all', isLive && 'border-green-400 bg-green-50')}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{match.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <Clock className="h-4 w-4" />
                          {scheduledDate ? formatter.format(scheduledDate) : 'Chưa xác định lịch'}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={isLive ? 'default' : match.status === 'finished' ? 'secondary' : 'outline'}
                        className={cn(isLive && 'animate-pulse')}
                      >
                        {isLive && <Radio className="h-3 w-3 mr-1" />}
                        {matchStatusLabel[match.status] ?? match.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {isLive && session ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border-2 border-green-300 bg-white p-3">
                          <p className="text-xs font-semibold text-green-700 uppercase mb-1">📱 Mã tham gia</p>
                          <p className="text-2xl font-mono font-bold text-green-900 tracking-widest">{session.join_code}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-slate-50 p-2">
                            <p className="text-xs text-muted-foreground">Vòng hiện tại</p>
                            <p className="font-semibold text-sm">
                              {session.current_round_type ? roundLabelMap[session.current_round_type] : '—'}
                            </p>
                          </div>
                          <div className="rounded-md bg-slate-50 p-2">
                            <p className="text-xs text-muted-foreground">Trạng thái câu</p>
                            <p className="font-semibold text-sm">{session.question_state ?? '—'}</p>
                          </div>
                        </div>

                        <Button asChild className="w-full gap-2 bg-green-600 hover:bg-green-700">
                          <Link href={`/olympia/client/game/${session.id}`}>
                            <Radio className="h-4 w-4" />
                            Xem trực tiếp
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          {match.status === 'scheduled'
                            ? 'Chờ thời gian diễn ra'
                            : 'Phòng thi này đã kết thúc'}
                        </p>
                        {match.status === 'scheduled' && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Hãy quay lại trang này vào thời gian trận diễn ra để tham gia
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <OlympiaRealtimeListener debounceMs={1000} />
      <LiveScheduleAutoRefresh intervalMs={90000} />
    </section>
  )
}
