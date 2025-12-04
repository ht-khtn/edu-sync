import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LiveSessionControls } from '@/components/olympia/LiveSessionControls'
import { HostRoundControls } from '@/components/olympia/HostRoundControls'
import { getServerAuthContext } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

const statusVariants: Record<string, string> = {
  draft: 'bg-slate-200 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  live: 'bg-green-100 text-green-700',
  finished: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

async function fetchHostData(matchId: string) {
  const { supabase } = await getServerAuthContext()
  const olympia = supabase.schema('olympia')

  const { data: match, error: matchError } = await olympia
    .from('matches')
    .select('id, name, status')
    .eq('id', matchId)
    .maybeSingle()
  if (matchError) throw matchError
  if (!match) return null

  const [{ data: liveSession, error: liveError }, { data: rounds, error: roundsError }] = await Promise.all([
    olympia
      .from('live_sessions')
      .select('match_id, status, join_code, question_state, current_round_type')
      .eq('match_id', matchId)
      .maybeSingle(),
    olympia
      .from('match_rounds')
      .select('id, round_type, order_index')
      .eq('match_id', matchId)
      .order('order_index', { ascending: true }),
  ])

  if (liveError) throw liveError
  if (roundsError) throw roundsError

  return {
    match,
    liveSession,
    rounds: rounds ?? [],
  }
}

export default async function OlympiaHostConsolePage({ params }: { params: { matchId: string } }) {
  const data = await fetchHostData(params.matchId)
  if (!data) {
    notFound()
  }

  const { match, liveSession, rounds } = data
  const statusClass = statusVariants[match.status] ?? 'bg-slate-100 text-slate-700'

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-sm text-muted-foreground">Console điều khiển trận</p>
          <h1 className="text-2xl font-semibold">{match.name}</h1>
        </div>
        <Badge className={statusClass}>{match.status}</Badge>
      </div>

      <div className="flex gap-3 text-sm">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/olympia/admin/matches/${match.id}`}>← Về chi tiết trận</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/olympia/admin/matches">Danh sách trận</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trạng thái phòng thi</CardTitle>
          <CardDescription>Khởi động hoặc kết thúc phòng live để sẵn sàng cho học sinh.</CardDescription>
        </CardHeader>
        <CardContent>
          <LiveSessionControls matchId={match.id} liveSession={liveSession ?? undefined} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Điều khiển vòng & câu hỏi</CardTitle>
          <CardDescription>Chọn vòng hiện tại và trạng thái hiển thị câu hỏi cho khán phòng.</CardDescription>
        </CardHeader>
        <CardContent>
          <HostRoundControls
            matchId={match.id}
            rounds={rounds}
            currentRoundType={liveSession?.current_round_type}
            currentQuestionState={liveSession?.question_state}
          />
        </CardContent>
      </Card>

      {liveSession?.status !== 'running' ? (
        <p className="text-sm text-amber-600">
          Lưu ý: bạn cần mở phòng (status running) trước khi chuyển vòng hoặc cập nhật trạng thái câu hỏi.
        </p>
      ) : null}
    </section>
  )
}
