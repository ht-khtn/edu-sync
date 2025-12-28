import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getServerAuthContext } from '@/lib/server-auth'
import { Radio, Clock, Users, Eye, ExternalLink } from 'lucide-react'
import { CopyRoomCodeButton } from '@/components/olympia/admin/matches/CopyRoomCodeButton'

// ISR: Sessions update every 30s via realtime listener
export const revalidate = 30

const formatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const questionStateLabel: Record<string, string> = {
  hidden: 'Ẩn',
  showing: 'Hiển thị',
  answer_revealed: 'Đáp án',
  completed: 'Hoàn tất',
}

type MatchRow = {
  id: string
  code: string | null
  name: string | null
  status: string | null
  scheduled_at: string | null
}

async function fetchLiveSessionsData() {
  const { supabase } = await getServerAuthContext()
  const olympia = supabase.schema('olympia')

  // Fetch all live sessions
  const [{ data: sessions, error: sessionsError }, { data: matches, error: matchesError }] = await Promise.all([
    olympia
      .from('live_sessions')
      .select('id, match_id, status, join_code, question_state, current_round_type, created_at, ended_at')
      .order('created_at', { ascending: false }),
    olympia
      .from('matches')
      .select('id, code, name, status, scheduled_at'),
  ])

  if (sessionsError) {
    console.error('[Olympia] Failed to load sessions:', sessionsError.message)
    return null
  }

  if (matchesError) {
    console.error('[Olympia] Failed to load matches:', matchesError.message)
  }

  const matchLookup = new Map(
    ((matches ?? []) as MatchRow[]).map((m) => [
      m.id,
      {
        name: m.name,
        status: m.status,
        scheduledAt: m.scheduled_at,
        code: m.code,
      },
    ])
  )

  // Fetch player counts for each session
  const sessionIds = (sessions ?? []).map((s) => s.match_id).filter(Boolean)
  let playerCounts = new Map<string, number>()

  if (sessionIds.length > 0) {
    const { data: playerData } = await olympia
      .from('match_players')
      .select('match_id')
      .in('match_id', [...new Set(sessionIds)])

    if (playerData) {
      const counts = new Map<string, number>()
      for (const player of playerData) {
        counts.set(player.match_id, (counts.get(player.match_id) ?? 0) + 1)
      }
      playerCounts = counts
    }
  }

  return {
    sessions: sessions ?? [],
    matchLookup,
    playerCounts,
  }
}

export default async function OlympiaAdminRoomsPage() {
  const data = await fetchLiveSessionsData()

  if (!data) {
    notFound()
  }

  const { sessions, matchLookup, playerCounts } = data

  const activeSessions = sessions.filter((s) => s.status === 'running')
  const pendingSessions = sessions.filter((s) => s.status === 'pending')
  const endedSessions = sessions.filter((s) => s.status === 'ended')

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase text-muted-foreground">Olympia</p>
        <h1 className="text-3xl font-bold tracking-tight">Quản lý phòng thi &amp; live session</h1>
        <p className="text-sm text-muted-foreground">
          Xem danh sách tất cả các phòng thi đang mở, quản lý session và điều khiển trực tuyến.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Phòng đang mở</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeSessions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeSessions.length === 1 ? '1 phòng' : `${activeSessions.length} phòng`} đang chạy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Chờ mở</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingSessions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingSessions.length === 1 ? '1 phòng' : `${pendingSessions.length} phòng`} chờ xử lý
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Đã kết thúc</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{endedSessions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {endedSessions.length === 1 ? '1 phòng' : `${endedSessions.length} phòng`} đã xong
            </p>
          </CardContent>
        </Card>
      </div>

      {activeSessions.length === 0 && pendingSessions.length === 0 ? (
        <Alert>
          <AlertDescription>Không có phòng thi nào đang mở hoặc chờ mở. Vào mục Giải &amp; trận để tạo.</AlertDescription>
        </Alert>
      ) : null}

      {activeSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-green-600" />
              Phòng đang mở
            </CardTitle>
            <CardDescription>Các phòng thi đang hoạt động</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-green-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-green-50">
                    <TableHead>Trận</TableHead>
                    <TableHead>Mã phòng</TableHead>
                    <TableHead>Vòng hiện tại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thí sinh</TableHead>
                    <TableHead>Khởi tạo lúc</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSessions.map((session) => {
                    const match = matchLookup.get(session.match_id)
                    const playerCount = playerCounts.get(session.match_id) ?? 0

                    return (
                      <TableRow key={session.id} className="hover:bg-green-50/50">
                        <TableCell className="font-medium">{match?.name ?? '—'}</TableCell>
                        <TableCell className="font-mono font-semibold text-green-700">
                          <div className="flex items-center gap-2 justify-start">
                            <span className="font-mono">{session.join_code}</span>
                            <CopyRoomCodeButton code={session.join_code} title="Sao chép mã phòng" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{session.current_round_type ?? '—'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="gap-1">
                            <Radio className="h-3 w-3" />
                            {questionStateLabel[session.question_state ?? 'hidden'] ?? session.question_state}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{playerCount}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {session.created_at ? formatter.format(new Date(session.created_at)) : '—'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                          >
                            <Link href={`/olympia/client/game/${session.join_code}`}>
                              <Eye className="h-4 w-4" />
                              Xem
                            </Link>
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="gap-1"
                          >
                            <Link href={`/olympia/admin/matches/${match?.code ?? session.match_id}/host`}>
                              <Radio className="h-4 w-4" />
                              Host
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {pendingSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Chờ mở
            </CardTitle>
            <CardDescription>Các phòng thi chưa được kích hoạt</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-blue-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50">
                    <TableHead>Trận</TableHead>
                    <TableHead>Mã phòng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Tạo lúc</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingSessions.map((session) => {
                    const match = matchLookup.get(session.match_id)

                    return (
                      <TableRow key={session.id} className="hover:bg-blue-50/50">
                        <TableCell className="font-medium">{match?.name ?? '—'}</TableCell>
                        <TableCell className="font-mono font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{session.join_code}</span>
                            <CopyRoomCodeButton code={session.join_code} title="Sao chép mã phòng" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Chờ mở</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {session.created_at ? formatter.format(new Date(session.created_at)) : '—'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                          >
                            <Link href={`/olympia/client/game/${session.join_code}`}>
                              <Eye className="h-4 w-4" />
                              Xem
                            </Link>
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="gap-1"
                          >
                            <Link href={`/olympia/admin/matches/${match?.code ?? session.match_id}/host`}>
                              <ExternalLink className="h-4 w-4" />
                              Mở
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {endedSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Đã kết thúc</CardTitle>
            <CardDescription>Các phòng thi đã hoàn tất</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Trận</TableHead>
                    <TableHead>Mã phòng</TableHead>
                    <TableHead>Vòng cuối</TableHead>
                    <TableHead>Kết thúc lúc</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endedSessions.map((session) => {
                    const match = matchLookup.get(session.match_id)

                    return (
                      <TableRow key={session.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-muted-foreground">{match?.name ?? '—'}</TableCell>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{session.join_code}</span>
                            <CopyRoomCodeButton code={session.join_code} title="Sao chép mã phòng" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{session.current_round_type ?? '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {session.ended_at ? formatter.format(new Date(session.ended_at)) : '—'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                          >
                            <Link href={`/olympia/client/game/${session.join_code}`}>
                              <Eye className="h-4 w-4" />
                              Xem
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm" className="gap-1">
                            <Link href={`/olympia/admin/matches/${match?.code ?? session.match_id}`}>
                              <Eye className="h-4 w-4" />
                              Kết quả
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bước tiếp theo</CardTitle>
          <CardDescription>Không thấy phòng bạn cần?</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/olympia/admin/matches">Xem danh sách giải &amp; trận</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}
