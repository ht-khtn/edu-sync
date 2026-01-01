import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LiveSessionControls } from '@/components/olympia/admin/matches/LiveSessionControls'
import { HostRoundControls } from '@/components/olympia/admin/matches/HostRoundControls'
import { LiveScoreboard } from '@/components/olympia/admin/matches/LiveScoreboard'
import { InitializeRoundsButton } from '@/components/olympia/admin/matches/InitializeRoundsButton'
import { getServerAuthContext } from '@/lib/server-auth'
import { advanceCurrentQuestionFormAction, confirmDecisionFormAction, setCurrentQuestionFormAction } from '@/app/(olympia)/olympia/actions'

type PlayerSummary = {
  seat_index: number | null
  display_name: string | null
}

type WinnerBuzzRow = {
  id: string
  player_id: string | null
  result: string | null
  occurred_at: string | null
  match_players: PlayerSummary | null
}

type RecentBuzzRow = WinnerBuzzRow

type RecentAnswerRow = {
  id: string
  player_id: string
  answer_text: string | null
  is_correct: boolean | null
  points_awarded: number | null
  submitted_at: string
  match_players: PlayerSummary | null
}

// KEEP force-dynamic: Host controls real-time game flow (send questions, manage timers)
export const dynamic = 'force-dynamic'

const statusVariants: Record<string, string> = {
  draft: 'bg-slate-200 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  live: 'bg-green-100 text-green-700',
  finished: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

const roundLabelMap: Record<string, string> = {
  khoi_dong: 'Khởi động',
  vcnv: 'Vượt chướng ngại vật',
  tang_toc: 'Tăng tốc',
  ve_dich: 'Về đích',
}

async function fetchHostData(matchCode: string) {
  const { supabase } = await getServerAuthContext()
  const olympia = supabase.schema('olympia')

  // Resolve match by id (route provides UUID)
  const { data: match, error: matchError } = await olympia
    .from('matches')
    .select('id, name, status')
    .eq('id', matchCode)
    .maybeSingle()
  if (matchError) throw matchError
  if (!match) return null

  const realMatchId = match.id

  const [{ data: liveSession, error: liveError }, { data: rounds, error: roundsError }, { data: players, error: playersError }, { data: scores, error: scoresError }] = await Promise.all([
    olympia
      .from('live_sessions')
      .select('id, match_id, status, join_code, question_state, current_round_type, current_round_id, current_round_question_id, requires_player_password')
      .eq('match_id', realMatchId)
      .maybeSingle(),
    olympia
      .from('match_rounds')
      .select('id, round_type, order_index')
      .eq('match_id', realMatchId)
      .order('order_index', { ascending: true }),
    olympia
      .from('match_players')
      .select('id, seat_index, display_name, participant_id')
      .eq('match_id', realMatchId)
      .order('seat_index', { ascending: true }),
    olympia
      .from('match_scores')
      .select('player_id, points')
      .eq('match_id', realMatchId),
  ])

  if (liveError) throw liveError
  if (roundsError) throw roundsError
  if (playersError) console.warn('[Olympia] Failed to load match players:', playersError.message)
  if (scoresError) console.warn('[Olympia] Failed to load match scores:', scoresError.message)

  const scoreLookup = new Map((scores ?? []).map((s) => [s.player_id, s.points ?? 0]))

  const { data: roundQuestions } = await olympia
    .from('round_questions')
    .select('id, match_round_id, order_index, question_id, match_rounds!inner(match_id, round_type)')
    .eq('match_rounds.match_id', realMatchId)
    .order('order_index', { ascending: true })
    .order('id', { ascending: true })

  const currentQuestionId = liveSession?.current_round_question_id

  const [{ data: winnerBuzz }, { data: recentBuzzes }, { data: recentAnswers }] = await Promise.all([
    currentQuestionId
      ? olympia
        .from('buzzer_events')
        .select('id, player_id, result, occurred_at, match_players(seat_index, display_name)')
        .eq('round_question_id', currentQuestionId)
        .eq('result', 'win')
        .order('occurred_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    currentQuestionId
      ? olympia
        .from('buzzer_events')
        .select('id, player_id, result, occurred_at, match_players(seat_index, display_name)')
        .eq('round_question_id', currentQuestionId)
        .order('occurred_at', { ascending: false })
        .limit(10)
      : Promise.resolve({ data: [] }),
    currentQuestionId
      ? olympia
        .from('answers')
        .select('id, player_id, answer_text, is_correct, points_awarded, submitted_at, match_players(seat_index, display_name)')
        .eq('round_question_id', currentQuestionId)
        .order('submitted_at', { ascending: false })
        .limit(10)
      : Promise.resolve({ data: [] }),
  ])

  return {
    match,
    liveSession,
    rounds: rounds ?? [],
    players: players ?? [],
    scores: (players ?? []).map((p) => ({
      playerId: p.id,
      displayName: p.display_name ?? `Ghế ${p.seat_index}`,
      seatNumber: p.seat_index,
      totalScore: scoreLookup.get(p.id) ?? 0,
    })),
    roundQuestions: roundQuestions ?? [],
    winnerBuzz: (winnerBuzz as WinnerBuzzRow | null) ?? null,
    recentBuzzes: (recentBuzzes as RecentBuzzRow[]) ?? [],
    recentAnswers: (recentAnswers as RecentAnswerRow[]) ?? [],
  }
}

export default async function OlympiaHostConsolePage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params

  // Validate matchId is a valid UUID before querying
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(matchId)) {
    notFound()
  }

  const data = await fetchHostData(matchId)
  if (!data) {
    notFound()
  }

  const { match, liveSession, rounds, players, scores, roundQuestions, winnerBuzz, recentBuzzes, recentAnswers } = data
  const currentRoundId = liveSession?.current_round_id
  const currentRoundQuestions = currentRoundId
    ? roundQuestions.filter((q) => q.match_round_id === currentRoundId)
    : roundQuestions
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

      <div className="flex gap-3 text-sm flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/olympia/admin/matches/${match.id}`}>← Về chi tiết trận</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/olympia/admin/matches">Danh sách trận</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {rounds.length === 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6 space-y-3">
                <p className="text-sm text-amber-900">
                  <strong>Chưa có vòng thi!</strong> Bạn cần tạo các vòng thi trước khi mở phòng hoặc gán câu hỏi.
                </p>
                <InitializeRoundsButton matchId={match.id} roundsCount={rounds.length} />
              </CardContent>
            </Card>
          )}
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

          {currentRoundQuestions.length > 0 && liveSession?.id ? (
            <Card>
              <CardHeader>
                <CardTitle>Chọn câu hỏi & hiển thị</CardTitle>
                <CardDescription>Chọn câu theo thứ tự để bật chế độ “Đang hiển thị” (timer 5s mặc định).</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={setCurrentQuestionFormAction} className="flex flex-col gap-3 md:flex-row md:items-end">
                  <input type="hidden" name="matchId" value={match.id} />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-slate-700">Câu hỏi</p>
                    <select
                      name="roundQuestionId"
                      defaultValue={liveSession.current_round_question_id ?? ''}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      required
                    >
                      <option value="" disabled>
                        Chọn câu trong vòng hiện tại
                      </option>
                      {currentRoundQuestions.map((q) => (
                        <option key={q.id} value={q.id}>
                          Câu #{q.order_index ?? '?'} · {q.question_id ?? 'n/a'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full md:w-32 space-y-1">
                    <p className="text-sm text-slate-700">Thời gian (ms)</p>
                    <input
                      type="number"
                      name="durationMs"
                      min={1000}
                      max={120000}
                      defaultValue={5000}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <Button type="submit" className="md:w-auto w-full">
                    Hiển thị câu
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {liveSession?.id ? (
            <Card>
              <CardHeader>
                <CardTitle>Điều hướng nhanh</CardTitle>
                <CardDescription>Chuyển câu trong vòng hiện tại (tuỳ chọn hiển thị luôn).</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={advanceCurrentQuestionFormAction} className="flex flex-col gap-3 md:flex-row md:items-end">
                  <input type="hidden" name="matchId" value={match.id} />
                  <div className="w-full md:w-28 space-y-1">
                    <p className="text-sm text-slate-700">Hướng</p>
                    <select
                      name="direction"
                      defaultValue="next"
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="prev">Trước</option>
                      <option value="next">Sau</option>
                    </select>
                  </div>
                  <div className="w-full md:w-32 space-y-1">
                    <p className="text-sm text-slate-700">Thời gian (ms)</p>
                    <input
                      type="number"
                      name="durationMs"
                      min={1000}
                      max={120000}
                      defaultValue={5000}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="autoShow" value="1" defaultChecked />
                    Hiển thị luôn
                  </label>
                  <Button type="submit" className="md:w-auto w-full">
                    Chuyển câu
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {liveSession?.current_round_question_id ? (
            <Card>
              <CardHeader>
                <CardTitle>Trạng thái câu hiện tại</CardTitle>
                <CardDescription>Theo dõi buzzer và đáp án gần nhất (top 10).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">RoundQuestion:</span>{' '}
                    <span className="font-mono">{liveSession.current_round_question_id}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">question_state: {liveSession.question_state ?? '—'}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Buzzer winner</p>
                    {winnerBuzz ? (
                      <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                        <p className="font-semibold">
                          Ghế {winnerBuzz.match_players?.seat_index ?? '—'}: {winnerBuzz.match_players?.display_name ?? '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {winnerBuzz.occurred_at ? new Date(winnerBuzz.occurred_at).toLocaleTimeString('vi-VN') : '—'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Chưa có winner.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Buzzer gần đây</p>
                    {recentBuzzes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Chưa có buzzer.</p>
                    ) : (
                      <div className="space-y-2">
                        {recentBuzzes.map((e) => (
                          <div key={e.id} className="rounded-md border border-slate-100 bg-white px-3 py-2 text-xs">
                            <p>
                              Ghế {e.match_players?.seat_index ?? '—'}: {e.match_players?.display_name ?? e.player_id ?? '—'}
                            </p>
                            <p className="text-muted-foreground">
                              {e.occurred_at ? new Date(e.occurred_at).toLocaleTimeString('vi-VN') : '—'} · {e.result ?? '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Đáp án gần đây</p>
                  {recentAnswers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có đáp án.</p>
                  ) : (
                    <div className="space-y-2">
                      {recentAnswers.map((a) => (
                        <div key={a.id} className="rounded-md border border-slate-100 bg-white px-3 py-2 text-xs">
                          <p className="font-semibold">
                            Ghế {a.match_players?.seat_index ?? '—'}: {a.match_players?.display_name ?? a.player_id ?? '—'}
                          </p>
                          <p className="text-muted-foreground">
                            {a.submitted_at ? new Date(a.submitted_at).toLocaleTimeString('vi-VN') : '—'}
                            {typeof a.is_correct === 'boolean' ? ` · ${a.is_correct ? 'ĐÚNG' : 'SAI'}` : ''}
                            {typeof a.points_awarded === 'number' ? ` · ${a.points_awarded >= 0 ? '+' : ''}${a.points_awarded}` : ''}
                          </p>
                          {a.answer_text ? <p className="mt-1">{a.answer_text}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {players.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Chấm điểm nhanh (Khởi động chung)</CardTitle>
                <CardDescription>Áp dụng +10 nếu đúng, -5 nếu sai/hết giờ (không âm).</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={confirmDecisionFormAction} className="space-y-3">
                  <input type="hidden" name="sessionId" value={liveSession?.id ?? ''} />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Chọn thí sinh</p>
                    <select
                      name="playerId"
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      defaultValue=""
                      required
                      disabled={!liveSession?.id}
                    >
                      <option value="" disabled>
                        Chọn thí sinh cần chấm
                      </option>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          Ghế {p.seat_index}: {p.display_name ?? 'Không tên'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Kết quả</p>
                    <select
                      name="decision"
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      defaultValue="correct"
                      required
                      disabled={!liveSession?.id}
                    >
                      <option value="correct">Đúng (+10)</option>
                      <option value="wrong">Sai (-5)</option>
                      <option value="timeout">Hết giờ (-5)</option>
                    </select>
                  </div>

                  <Button type="submit" size="sm" disabled={!liveSession?.id}>
                    Xác nhận
                  </Button>
                  {!liveSession?.id ? (
                    <p className="text-xs text-muted-foreground">Cần mở phòng live để thao tác chấm điểm.</p>
                  ) : null}
                </form>
              </CardContent>
            </Card>
          )}

          {players.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Danh sách thí sinh</CardTitle>
                <CardDescription>Các thí sinh tham gia trận này</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Ghế</TableHead>
                        <TableHead>Tên thí sinh</TableHead>
                        <TableHead className="text-right">Điểm</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {players.map((player) => {
                        const score = scores.find((s) => s.playerId === player.id)
                        return (
                          <TableRow key={player.id}>
                            <TableCell className="font-medium">{player.seat_index ?? '—'}</TableCell>
                            <TableCell>{player.display_name ?? '—'}</TableCell>
                            <TableCell className="text-right font-semibold">{score?.totalScore ?? 0}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {scores.length > 0 && (
            <LiveScoreboard
              matchId={match.id}
              scores={scores}
              title="Xếp hạng trực tiếp"
              description="Cập nhật điểm số các thí sinh"
            />
          )}

          {liveSession?.status !== 'running' && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <p className="text-sm text-amber-800">
                  <strong>Lưu ý:</strong> Bạn cần mở phòng trước khi thay đổi vòng hoặc cập nhật trạng thái câu hỏi.
                </p>
              </CardContent>
            </Card>
          )}

          {liveSession?.status === 'running' && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-green-900">Thông tin phòng</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div>
                  <p className="text-green-700 font-semibold">Mã tham gia:</p>
                  <p className="font-mono text-lg text-green-900">{liveSession?.join_code ?? '—'}</p>
                </div>
                <div>
                  <p className="text-green-700 font-semibold">Vòng hiện tại:</p>
                  <p>{liveSession?.current_round_type ? roundLabelMap[liveSession.current_round_type] ?? liveSession.current_round_type : 'Chưa đặt'}</p>
                </div>
                <div>
                  <p className="text-green-700 font-semibold">Trạng thái câu hỏi:</p>
                  <p>{liveSession?.question_state ?? '—'}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  )
}
