import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LiveSessionControls } from '@/components/olympia/LiveSessionControls'
import { getServerAuthContext } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

const statusVariants: Record<string, string> = {
  draft: 'bg-slate-200 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  live: 'bg-green-100 text-green-700',
  finished: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

const roundLabel: Record<string, string> = {
  khoi_dong: 'Khởi động',
  vcnv: 'Vượt chướng ngại vật',
  tang_toc: 'Tăng tốc',
  ve_dich: 'Về đích',
}

const formatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'full',
  timeStyle: 'short',
})

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return formatter.format(new Date(value))
  } catch {
    return value
  }
}

async function fetchMatchDetail(matchId: string) {
  const { supabase } = await getServerAuthContext()

  const { data: match, error: matchError } = await supabase
    .from('olympia.matches')
    .select('id, name, status, scheduled_at, tournament_id, host_user_id, metadata, created_at, updated_at')
    .eq('id', matchId)
    .maybeSingle()

  if (matchError) throw matchError
  if (!match) return null

  const tournamentPromise = match.tournament_id
    ? supabase
        .from('olympia.tournaments')
        .select('id, name, status, starts_at, ends_at')
        .eq('id', match.tournament_id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const [liveSessionResult, playersResult, roundsResult, tournamentResult] = await Promise.all([
    supabase
      .from('olympia.live_sessions')
      .select('match_id, status, join_code, question_state, current_round_type, timer_deadline')
      .eq('match_id', matchId)
      .maybeSingle(),
    supabase
      .from('olympia.match_players')
      .select('id, seat_index, display_name, participant_id, created_at')
      .eq('match_id', matchId)
      .order('seat_index', { ascending: true }),
    supabase
      .from('olympia.match_rounds')
      .select('id, round_type, order_index, config')
      .eq('match_id', matchId)
      .order('order_index', { ascending: true }),
    tournamentPromise,
  ])

  if (liveSessionResult.error) throw liveSessionResult.error
  if (playersResult.error) throw playersResult.error
  if (roundsResult.error) throw roundsResult.error
  if (tournamentResult && tournamentResult.error) throw tournamentResult.error

  let participantLookup = new Map<string, { contestant_code: string | null; role: string | null }>()
  const playerParticipantIds = (playersResult.data ?? [])
    .map((player) => player.participant_id)
    .filter((value): value is string => Boolean(value))

  if (playerParticipantIds.length > 0) {
    const { data: participants, error: participantError } = await supabase
      .from('olympia.participants')
      .select('user_id, contestant_code, role')
      .in('user_id', playerParticipantIds)

    if (participantError) throw participantError
    participantLookup = new Map(
      (participants ?? []).map((participant) => [participant.user_id, participant])
    )
  }

  return {
    match,
    tournament: tournamentResult?.data ?? null,
    liveSession: liveSessionResult.data,
    players: playersResult.data ?? [],
    rounds: roundsResult.data ?? [],
    participantLookup,
  }
}

export default async function OlympiaMatchDetailPage({ params }: { params: { matchId: string } }) {
  const details = await fetchMatchDetail(params.matchId)
  if (!details) {
    notFound()
  }

  const { match, tournament, liveSession, players, rounds, participantLookup } = details
  const statusClass = statusVariants[match.status] ?? 'bg-slate-100 text-slate-700'

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Mã trận · {match.id}</p>
            <h1 className="text-3xl font-semibold tracking-tight">{match.name}</h1>
            <div className="flex gap-3 text-sm text-muted-foreground">
              <span>Lịch dự kiến: {formatDate(match.scheduled_at)}</span>
              <span>· Cập nhật: {formatDate(match.updated_at)}</span>
            </div>
          </div>
          <Badge className={statusClass}>{match.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>Host: {match.host_user_id ?? '—'}</span>
          <span>Giải đấu: {tournament ? tournament.name : 'Chưa gán'}</span>
        </div>
        <div className="flex gap-3 text-sm">
          <Button asChild variant="ghost" size="sm">
            <Link href="/olympia/admin/matches">← Trở lại danh sách</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/olympia/admin">Về dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Phiên live hiện tại</CardTitle>
            <CardDescription>
              Mở hoặc kết thúc phòng thi để cập nhật realtime cho thí sinh và khán phòng trực tuyến.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiveSessionControls matchId={match.id} liveSession={liveSession ?? undefined} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Thông tin giải đấu</CardTitle>
            <CardDescription>Giải mà trận này trực thuộc.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {tournament ? (
              <>
                <p className="text-base font-medium text-slate-900">{tournament.name}</p>
                <p>Trạng thái: {tournament.status ?? '—'}</p>
                <p>Bắt đầu: {formatDate(tournament.starts_at)}</p>
                <p>Kết thúc: {formatDate(tournament.ends_at)}</p>
              </>
            ) : (
              <p>Trận chưa được gán vào giải đấu cụ thể.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách thí sinh</CardTitle>
          <CardDescription>
            Sắp xếp theo thứ tự ghế, hiển thị mã thí sinh và trạng thái hiện tại. Những ghế chưa gán bị để trống.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có thí sinh nào được gán cho trận này.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ghế</TableHead>
                  <TableHead>Họ tên hiển thị</TableHead>
                  <TableHead>Mã thí sinh</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Thời gian gán</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => {
                  const participant = player.participant_id
                    ? participantLookup.get(player.participant_id)
                    : null
                  return (
                    <TableRow key={player.id}>
                      <TableCell>Ghế {player.seat_index}</TableCell>
                      <TableCell className="font-medium">{player.display_name ?? '—'}</TableCell>
                      <TableCell>{participant?.contestant_code ?? '—'}</TableCell>
                      <TableCell>{participant?.role ?? 'contestant'}</TableCell>
                      <TableCell>{formatDate(player.created_at)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cấu hình vòng thi</CardTitle>
          <CardDescription>Mỗi vòng tương ứng với cấu hình trong bảng olympia.match_rounds.</CardDescription>
        </CardHeader>
        <CardContent>
          {rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa cấu hình vòng thi cho trận này.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rounds.map((round) => (
                <div key={round.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold">
                    Vòng {round.order_index + 1}: {roundLabel[round.round_type] ?? round.round_type}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Config: {round.config ? JSON.stringify(round.config) : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
