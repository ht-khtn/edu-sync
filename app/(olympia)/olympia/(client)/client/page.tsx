import Link from 'next/link'
import { JoinQuickTabs } from '@/components/olympia/client/client/JoinQuickTabs'
import { LiveScheduleRealtime } from '@/components/olympia/client/client/LiveScheduleRealtime'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getServerAuthContext } from '@/lib/server-auth'
import { cache } from 'react'
import { Calendar } from 'lucide-react'
import { OlympiaAccountMenu } from '@/components/olympia/client/OlympiaAccountMenu'

// ISR: Match schedule updates every 30s. Real-time listener handles live updates.
export const revalidate = 30

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
  const { supabase } = await getServerAuthContext()
  const olympia = supabase.schema('olympia')

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

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">🎮 Olympia Quiz Live</h1>
            <p className="text-lg text-muted-foreground mt-2">
              Thi trắc nghiệm trực tuyến theo hình thức game show
            </p>
          </div>

          <div className="shrink-0">
            <OlympiaAccountMenu loginRedirectTo="/olympia/client" />
          </div>
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

      <LiveScheduleRealtime initialMatches={matches} initialSessions={sessions} />
    </section>
  )
}
