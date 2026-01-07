import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CreateMatchDialog } from '@/components/olympia/admin/matches/CreateMatchDialog'
import { CreateTournamentDialog } from '@/components/olympia/admin/matches/CreateTournamentDialogEntry'
import { EditTournamentDialog } from '@/components/olympia/admin/matches/EditTournamentDialog'
import { EditMatchDialog } from '@/components/olympia/admin/matches/EditMatchDialog'
import { LiveSessionControls } from '@/components/olympia/admin/matches/LiveSessionControls'
import { getServerAuthContext } from '@/lib/server-auth'

// ISR: Cache for 30 seconds, match data updates frequently
export const revalidate = 30;

const statusColorMap: Record<string, string> = {
  draft: 'bg-slate-200 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  live: 'bg-green-100 text-green-700',
  finished: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

const tournamentStatusLabel: Record<string, string> = {
  planned: 'Lên lịch',
  active: 'Đang diễn ra',
  archived: 'Đã lưu trữ',
}

const formatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const formatDate = (value: string | null) => {
  if (!value) return '—'
  try {
    return formatter.format(new Date(value))
  } catch {
    return value
  }
}

async function fetchMatchesData() {
  const { supabase } = await getServerAuthContext()
  const olympia = supabase.schema('olympia')

  const [{ data: tournaments, error: tournamentError }, { data: matches, error: matchError }] = await Promise.all([
    olympia
      .from('tournaments')
      .select('id, name, status, starts_at, ends_at')
      .order('starts_at', { ascending: true, nullsFirst: true }),
    olympia
      .from('matches')
      .select('id, name, status, scheduled_at, tournament_id')
      .order('scheduled_at', { ascending: true, nullsFirst: true }),
  ])

  if (tournamentError) throw tournamentError
  if (matchError) throw matchError

  let liveSessions: Array<{
    id: string
    match_id: string
    status: string | null
    join_code: string | null
    question_state: string | null
    current_round_type: string | null
    requires_player_password?: boolean
  }> = []

  if (matches && matches.length > 0) {
    const matchIds = matches.map((match) => match.id)
    const { data: sessions, error: sessionsError } = await olympia
      .from('live_sessions')
      .select('id, match_id, status, join_code, question_state, current_round_type, requires_player_password')
      .in('match_id', matchIds)

    if (sessionsError) throw sessionsError
    liveSessions = sessions ?? []
  }

  return {
    tournaments: tournaments ?? [],
    matches: matches ?? [],
    liveSessions,
  }
}

export default async function OlympiaMatchesAdminPage() {
  const { tournaments, matches, liveSessions } = await fetchMatchesData()
  const tournamentLookup = new Map(tournaments.map((t) => [t.id, t]))
  const liveSessionLookup = new Map(liveSessions.map((session) => [session.match_id, session]))


  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Giải đấu & lịch trận</h2>
          <p className="text-sm text-muted-foreground">
            Dữ liệu lấy trực tiếp từ schema olympia.{" "}
            <span className="font-medium text-slate-900">tournaments</span> và{' '}
            <span className="font-medium text-slate-900">matches</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <CreateTournamentDialog />
          <CreateMatchDialog tournaments={tournaments} />
        </div>
      </div>
      {tournaments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Danh sách giải đấu</CardTitle>
            <p className="text-xs text-muted-foreground">Tổng số: {tournaments.length} giải</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên giải</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày bắt đầu</TableHead>
                  <TableHead>Ngày kết thúc</TableHead>
                  <TableHead>Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tournaments.map((tournament) => (
                  <TableRow key={tournament.id}>
                    <TableCell className="font-medium">{tournament.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {tournamentStatusLabel[tournament.status] ?? tournament.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(tournament.starts_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(tournament.ends_at)}
                    </TableCell>
                    <TableCell>
                      <EditTournamentDialog
                        tournamentId={tournament.id}
                        currentName={tournament.name}
                        currentStatus={tournament.status}
                        currentStartsAt={tournament.starts_at}
                        currentEndsAt={tournament.ends_at}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {matches.length === 0 ? (
        <Alert>
          <AlertTitle>Chưa có trận nào</AlertTitle>
          <AlertDescription>
            Khi chạy migration olympia và chèn dữ liệu mẫu, danh sách trận sẽ hiển thị tại đây.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Danh sách trận</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên trận</TableHead>
                  <TableHead>Giải đấu</TableHead>
                  <TableHead>Lịch</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Live session</TableHead>
                  <TableHead>Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => {
                  const tournament = match.tournament_id ? tournamentLookup.get(match.tournament_id) : null
                  const statusClass = statusColorMap[match.status] ?? 'bg-slate-100 text-slate-700'
                  const session = liveSessionLookup.get(match.id)
                  return (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/olympia/admin/matches/${match.id}`}
                          className="text-primary hover:underline"
                        >
                          {match.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {tournament ? (
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{tournament.name}</p>
                            {tournament.status ? (
                              <p className="text-xs text-muted-foreground">
                                {tournamentStatusLabel[tournament.status] ?? tournament.status}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Chưa gán giải</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(match.scheduled_at)}</TableCell>
                      <TableCell>
                        <Badge className={statusClass}>{match.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <LiveSessionControls matchId={match.id} liveSession={session} />
                      </TableCell>
                      <TableCell>
                        <EditMatchDialog
                          matchId={match.id}
                          currentName={match.name}
                          currentTournamentId={match.tournament_id}
                          currentStatus={match.status}
                          currentScheduledAt={match.scheduled_at}
                          tournaments={tournaments}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
