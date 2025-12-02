import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getServerAuthContext } from '@/lib/server-auth'

type TournamentRow = {
  id: string
  name: string
  status: string | null
  starts_at: string | null
  ends_at: string | null
}

type MatchRow = {
  id: string
  name: string
  status: string
  scheduled_at: string | null
  tournament_id: string | null
}

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

  const [{ data: tournaments, error: tournamentError }, { data: matches, error: matchError }] = await Promise.all([
    supabase
      .from('olympia.tournaments')
      .select('id, name, status, starts_at, ends_at')
      .order('starts_at', { ascending: true, nullsFirst: true }),
    supabase
      .from('olympia.matches')
      .select('id, name, status, scheduled_at, tournament_id')
      .order('scheduled_at', { ascending: true, nullsFirst: true }),
  ])

  if (tournamentError) throw tournamentError
  if (matchError) throw matchError

  return {
    tournaments: tournaments ?? [],
    matches: matches ?? [],
  }
}

export default async function OlympiaMatchesAdminPage() {
  const { tournaments, matches } = await fetchMatchesData()
  const tournamentLookup = new Map(tournaments.map((t) => [t.id, t]))

  const summary = {
    totalTournaments: tournaments.length,
    totalMatches: matches.length,
    draft: matches.filter((m) => m.status === 'draft').length,
    scheduled: matches.filter((m) => m.status === 'scheduled').length,
    live: matches.filter((m) => m.status === 'live').length,
  }

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
          <Button variant="outline" size="sm">
            Xuất CSV
          </Button>
          <Button size="sm">Tạo trận mới</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng giải</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalTournaments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng trận</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalMatches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Đang nháp</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Đã lên lịch</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.scheduled}</p>
          </CardContent>
        </Card>
      </div>

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => {
                  const tournament = match.tournament_id ? tournamentLookup.get(match.tournament_id) : null
                  const statusClass = statusColorMap[match.status] ?? 'bg-slate-100 text-slate-700'
                  return (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">{match.name}</TableCell>
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
