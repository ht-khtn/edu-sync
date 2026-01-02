import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HostRoundControls } from '@/components/olympia/admin/matches/HostRoundControls'
import { HostPreviewQuestionSelect } from '@/components/olympia/admin/matches/HostPreviewQuestionSelect'
import { LiveScoreboard } from '@/components/olympia/admin/matches/LiveScoreboard'
import { InitializeRoundsButton } from '@/components/olympia/admin/matches/InitializeRoundsButton'
import { getServerAuthContext } from '@/lib/server-auth'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  Hand,
  Sparkles,
  Timer,
  Undo2,
  X,
} from 'lucide-react'
import {
  autoScoreTangTocFormAction,
  confirmDecisionFormAction,
  confirmVeDichMainDecisionFormAction,
  confirmVeDichStealDecisionFormAction,
  openStealWindowFormAction,
  setCurrentQuestionFormAction,
  setVeDichQuestionValueFormAction,
  toggleStarUseFormAction,
  undoLastScoreChangeFormAction,
} from '@/app/(olympia)/olympia/actions'

type PlayerSummary = {
  seat_index: number | null
  display_name: string | null
}

function normalizePlayerSummary(value: PlayerSummary | PlayerSummary[] | null | undefined): PlayerSummary | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

type WinnerBuzzRow = {
  id: string
  player_id: string | null
  result: string | null
  occurred_at: string | null
  match_players: PlayerSummary | PlayerSummary[] | null
}

type RecentBuzzRow = WinnerBuzzRow

type RecentAnswerRow = {
  id: string
  player_id: string
  answer_text: string | null
  is_correct: boolean | null
  points_awarded: number | null
  submitted_at: string
  match_players: PlayerSummary | PlayerSummary[] | null
}

type ScoreChangeRow = {
  id: string
  player_id: string
  round_type: string
  requested_delta: number
  applied_delta: number
  points_before: number
  points_after: number
  source: string
  reason: string | null
  created_at: string
  revert_of: string | null
  reverted_at: string | null
  match_players: PlayerSummary | PlayerSummary[] | null
}

type HostObstacleRow = {
  id: string
  match_round_id: string
  title: string | null
}

type HostObstacleTileRow = {
  id: string
  round_question_id: string | null
  position_index: number
  is_open: boolean
}

type HostObstacleGuessRow = {
  id: string
  player_id: string
  guess_text: string
  is_correct: boolean
  attempt_order: number | null
  attempted_at: string
  match_players: PlayerSummary | PlayerSummary[] | null
}

type RoundQuestionRow = {
  id: string
  match_round_id: string
  order_index: number
  question_id: string | null
  question_set_item_id: string | null
  target_player_id: string | null
  meta: Record<string, unknown> | null
  question_text: string | null
  answer_text: string | null
  note: string | null
  match_rounds?: RoundJoinRow | RoundJoinRow[] | null | undefined
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

type RoundJoinRow = {
  match_id: string
  round_type: string | null
}

function normalizeRoundJoin(value: RoundJoinRow | RoundJoinRow[] | null | undefined): RoundJoinRow | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function getMetaCode(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null
  const code = meta.code
  return typeof code === 'string' && code.trim() ? code : null
}

function getRoundQuestionLabel(q: Pick<RoundQuestionRow, 'id' | 'question_set_item_id' | 'meta'>): string {
  return getMetaCode(q.meta) ?? q.question_set_item_id ?? q.id
}

function getKhoiDongCodeInfo(code: string | null): { kind: 'personal'; seat: number } | { kind: 'common' } | null {
  if (!code) return null
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) return null

  if (trimmed.startsWith('DKA-')) {
    return { kind: 'common' }
  }

  // KD{seat}-{stt}
  const m = /^KD(\d+)-/i.exec(trimmed)
  if (!m) return null
  const seat = Number(m[1])
  if (!Number.isFinite(seat)) return null
  return { kind: 'personal', seat }
}

function isKhoiDongCommonByCode(code: string | null) {
  return getKhoiDongCodeInfo(code)?.kind === 'common'
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

  // Route param historically is match UUID, nhưng user cũng hay copy/paste join_code.
  // Hỗ trợ cả 2 để tránh 404.
  let realMatchId: string | null = null
  if (isUuid(matchCode)) {
    realMatchId = matchCode
  } else {
    const { data: sessionByJoin, error: sessionByJoinError } = await olympia
      .from('live_sessions')
      .select('match_id')
      .eq('join_code', matchCode)
      .maybeSingle()
    if (sessionByJoinError) throw sessionByJoinError
    realMatchId = sessionByJoin?.match_id ?? null
  }
  if (!realMatchId) return null

  const { data: match, error: matchError } = await olympia
    .from('matches')
    .select('id, name, status')
    .eq('id', realMatchId)
    .maybeSingle()
  if (matchError) throw matchError
  if (!match) return null

  const [{ data: liveSession, error: liveError }, { data: rounds, error: roundsError }, { data: players, error: playersError }, { data: scores, error: scoresError }] = await Promise.all([
    olympia
      .from('live_sessions')
      .select('id, match_id, status, join_code, question_state, current_round_type, current_round_id, current_round_question_id, timer_deadline, requires_player_password, buzzer_enabled')
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

  const scoreLookup = new Map<string, number>()
  for (const s of scores ?? []) {
    const prev = scoreLookup.get(s.player_id) ?? 0
    scoreLookup.set(s.player_id, prev + (s.points ?? 0))
  }

  const { data: roundQuestions } = await olympia
    .from('round_questions')
    .select(
      'id, match_round_id, order_index, question_id, question_set_item_id, target_player_id, meta, question_text, answer_text, note, match_rounds!inner(match_id, round_type)'
    )
    .eq('match_rounds.match_id', realMatchId)
    .order('order_index', { ascending: true })
    .order('id', { ascending: true })

  const currentQuestionId = liveSession?.current_round_question_id

  const currentRoundQuestion = currentQuestionId ? roundQuestions?.find((q) => q.id === currentQuestionId) ?? null : null

  const { data: currentStar } =
    currentQuestionId && currentRoundQuestion?.target_player_id
      ? await olympia
        .from('star_uses')
        .select('id')
        .eq('match_id', realMatchId)
        .eq('round_question_id', currentQuestionId)
        .eq('player_id', currentRoundQuestion.target_player_id)
        .maybeSingle()
      : { data: null }

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

  let obstacle: HostObstacleRow | null = null
  let obstacleTiles: HostObstacleTileRow[] = []
  let obstacleGuesses: HostObstacleGuessRow[] = []
  if (liveSession?.current_round_type === 'vcnv' && liveSession.current_round_id) {
    const { data: obstacleRow } = await olympia
      .from('obstacles')
      .select('id, match_round_id, title')
      .eq('match_round_id', liveSession.current_round_id)
      .maybeSingle()
    obstacle = (obstacleRow as HostObstacleRow | null) ?? null

    if (obstacle?.id) {
      const [{ data: tiles }, { data: guesses }] = await Promise.all([
        olympia
          .from('obstacle_tiles')
          .select('id, round_question_id, position_index, is_open')
          .eq('obstacle_id', obstacle.id)
          .order('position_index', { ascending: true }),
        olympia
          .from('obstacle_guesses')
          .select('id, player_id, guess_text, is_correct, attempt_order, attempted_at, match_players(seat_index, display_name)')
          .eq('obstacle_id', obstacle.id)
          .order('attempted_at', { ascending: false })
          .limit(10),
      ])
      obstacleTiles = (tiles as HostObstacleTileRow[] | null) ?? []
      obstacleGuesses = (guesses as HostObstacleGuessRow[] | null) ?? []
    }
  }

  let scoreChanges: ScoreChangeRow[] = []
  let scoreChangesError: string | null = null
  const { data: scoreChangesData, error: scoreChangesErr } = await olympia
    .from('score_changes')
    .select(
      'id, player_id, round_type, requested_delta, applied_delta, points_before, points_after, source, reason, created_at, revert_of, reverted_at, match_players(seat_index, display_name)'
    )
    .eq('match_id', realMatchId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (scoreChangesErr) {
    scoreChangesError = scoreChangesErr.message
  } else {
    scoreChanges = (scoreChangesData as unknown as ScoreChangeRow[] | null) ?? []
  }

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
    currentRoundQuestion,
    isStarEnabled: Boolean(currentStar?.id),
    winnerBuzz: (winnerBuzz as WinnerBuzzRow | null) ?? null,
    recentBuzzes: (recentBuzzes as RecentBuzzRow[]) ?? [],
    recentAnswers: (recentAnswers as RecentAnswerRow[]) ?? [],
    scoreChanges,
    scoreChangesError,
    obstacle,
    obstacleTiles,
    obstacleGuesses,
  }
}

export default async function OlympiaHostConsolePage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>
  searchParams?: Promise<{ preview?: string | string[] }>
}) {
  const { matchId } = await params
  const resolvedSearchParams = (searchParams ? await searchParams : {}) as { preview?: string | string[] }
  const previewParam = Array.isArray(resolvedSearchParams.preview)
    ? resolvedSearchParams.preview[0]
    : resolvedSearchParams.preview

  const data = await fetchHostData(matchId)
  if (!data) {
    notFound()
  }

  const {
    match,
    liveSession,
    rounds,
    players,
    scores,
    roundQuestions,
    currentRoundQuestion,
    isStarEnabled,
    winnerBuzz,
    recentAnswers,
  } = data
  const currentRoundId = liveSession?.current_round_id
  const currentRoundQuestions = currentRoundId
    ? roundQuestions.filter((q) => q.match_round_id === currentRoundId)
    : roundQuestions
  const statusClass = statusVariants[match.status] ?? 'bg-slate-100 text-slate-700'

  const questionsByRoundType = new Map<string, string[]>()
  for (const q of roundQuestions) {
    const roundType = normalizeRoundJoin((q as unknown as { match_rounds?: RoundJoinRow | RoundJoinRow[] | null | undefined }).match_rounds)?.round_type
    const key = roundType ?? 'unknown'
    const label = getRoundQuestionLabel(q as unknown as RoundQuestionRow)
    const list = questionsByRoundType.get(key) ?? []
    list.push(label)
    questionsByRoundType.set(key, list)
  }
  const questionsByRoundTypeEntries = Array.from(questionsByRoundType.entries())
    .map(([roundType, codes]) => ({ roundType, codes }))
    .sort((a, b) => a.roundType.localeCompare(b.roundType))

  const previewRoundQuestionId =
    previewParam && currentRoundQuestions.some((q) => q.id === previewParam)
      ? previewParam
      : liveSession?.current_round_question_id && currentRoundQuestions.some((q) => q.id === liveSession.current_round_question_id)
        ? liveSession.current_round_question_id
        : currentRoundQuestions[0]?.id

  const previewRoundQuestion = previewRoundQuestionId
    ? currentRoundQuestions.find((q) => q.id === previewRoundQuestionId) ?? null
    : null

  const selectedTargetPlayerId = currentRoundQuestion?.target_player_id ?? null
  const selectedTargetSeat = selectedTargetPlayerId
    ? players.find((p) => p.id === selectedTargetPlayerId)?.seat_index ?? null
    : null

  const isKhoiDong = liveSession?.current_round_type === 'khoi_dong'
  const isVeDich = liveSession?.current_round_type === 've_dich'
  const allowTargetSelection = Boolean(isKhoiDong || isVeDich)

  const filteredCurrentRoundQuestions = (() => {
    if (!isKhoiDong) return currentRoundQuestions

    // Lọc theo luật mã câu:
    // - Thi chung: DKA-
    // - Thi riêng: KD{seat}-
    if (typeof selectedTargetSeat === 'number') {
      const prefix = `KD${selectedTargetSeat}-`
      return currentRoundQuestions.filter((q) => {
        const code = getMetaCode((q as unknown as RoundQuestionRow).meta)
        return typeof code === 'string' && code.toUpperCase().startsWith(prefix)
      })
    }

    // Mặc định thi chung (DKA-) khi chưa chọn thí sinh.
    return currentRoundQuestions.filter((q) => {
      const code = getMetaCode((q as unknown as RoundQuestionRow).meta)
      return getKhoiDongCodeInfo(code)?.kind === 'common'
    })
  })()
  const previewIndex = previewRoundQuestionId
    ? currentRoundQuestions.findIndex((q) => q.id === previewRoundQuestionId)
    : -1
  const previewPrevId = previewIndex > 0 ? currentRoundQuestions[previewIndex - 1]?.id ?? null : null
  const previewNextId =
    previewIndex >= 0 && previewIndex < currentRoundQuestions.length - 1
      ? currentRoundQuestions[previewIndex + 1]?.id ?? null
      : null

  const hostPath = `/olympia/admin/matches/${matchId}/host`

  const veDichValueRaw =
    currentRoundQuestion?.meta && typeof currentRoundQuestion.meta === 'object'
      ? (currentRoundQuestion.meta as Record<string, unknown>).ve_dich_value
      : undefined
  const veDichValue = typeof veDichValueRaw === 'number' ? veDichValueRaw : veDichValueRaw ? Number(veDichValueRaw) : undefined
  const veDichValueText = veDichValue === 20 || veDichValue === 30 ? String(veDichValue) : ''

  type PreviewQuestionType = {
    code: string
    category: string | null
    question_text: string
    answer_text: string
    note: string | null
    image_url: string | null
    audio_url: string | null
  }

  const previewJoinedQuestion: PreviewQuestionType | null = previewRoundQuestion ? {
    code: '',
    category: null,
    question_text: (previewRoundQuestion as unknown as RoundQuestionRow).question_text ?? '',
    answer_text: (previewRoundQuestion as unknown as RoundQuestionRow).answer_text ?? '',
    note: (previewRoundQuestion as unknown as RoundQuestionRow).note ?? null,
    image_url: null,
    audio_url: null,
  } : null
  const previewQuestionText = previewJoinedQuestion?.question_text ?? null
  const previewAnswerText = previewJoinedQuestion?.answer_text ?? null
  const previewNoteText = previewJoinedQuestion?.note ?? null
  const previewQuestionCode = previewRoundQuestion
    ? getMetaCode((previewRoundQuestion as unknown as RoundQuestionRow).meta)
    : null


  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Host console</p>
          <h1 className="truncate text-xl font-semibold">{match.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" title="Về chi tiết trận" aria-label="Về chi tiết trận">
            <Link href={`/olympia/admin/matches/${match.id}`}>
              <ArrowLeft />
            </Link>
          </Button>
          <Badge className={statusClass}>{match.status}</Badge>
        </div>
      </div>

      {rounds.length === 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-amber-900">
              <strong>Chưa có vòng thi!</strong> Cần tạo vòng trước khi mở phòng / gán câu.
            </p>
            <InitializeRoundsButton matchId={match.id} roundsCount={rounds.length} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base">Câu hỏi</CardTitle>
                  <CardDescription>
                    {(() => {
                      if (!liveSession?.current_round_type) return 'Chưa chọn vòng'
                      const roundText = roundLabelMap[liveSession.current_round_type] ?? liveSession.current_round_type
                      if (!allowTargetSelection) return roundText
                      if (selectedTargetPlayerId) {
                        const p = players.find((x) => x.id === selectedTargetPlayerId)
                        const label = p?.display_name ?? (p?.seat_index != null ? `Ghế ${p.seat_index}` : 'Thí sinh')
                        return `${roundText} · Thí sinh: ${label}`
                      }
                      if (isKhoiDong) return `${roundText} · Thi chung`
                      return roundText
                    })()}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  {previewPrevId ? (
                    <Button asChild size="icon-sm" variant="outline" title="Xem câu trước" aria-label="Xem câu trước">
                      <Link href={`${hostPath}?preview=${encodeURIComponent(previewPrevId)}`}>
                        <ArrowLeft />
                      </Link>
                    </Button>
                  ) : (
                    <Button size="icon-sm" variant="outline" disabled title="Xem câu trước" aria-label="Xem câu trước">
                      <ArrowLeft />
                    </Button>
                  )}

                  <HostPreviewQuestionSelect
                    value={previewRoundQuestionId ?? ''}
                    disabled={filteredCurrentRoundQuestions.length === 0}
                    options={filteredCurrentRoundQuestions.map((q) => ({
                      id: q.id,
                      label: `#${q.order_index ?? '?'} · ${getRoundQuestionLabel(q as unknown as RoundQuestionRow)}`,
                    }))}
                    triggerReset={!currentRoundQuestion?.target_player_id || liveSession?.current_round_question_id === null}
                  />

                  {previewNextId ? (
                    <Button asChild size="icon-sm" variant="outline" title="Xem câu sau" aria-label="Xem câu sau">
                      <Link href={`${hostPath}?preview=${encodeURIComponent(previewNextId)}`}>
                        <ArrowRight />
                      </Link>
                    </Button>
                  ) : (
                    <Button size="icon-sm" variant="outline" disabled title="Xem câu sau" aria-label="Xem câu sau">
                      <ArrowRight />
                    </Button>
                  )}

                  <form action={setCurrentQuestionFormAction} className="flex">
                    <input type="hidden" name="matchId" value={match.id} />
                    <input type="hidden" name="roundQuestionId" value={previewRoundQuestionId ?? ''} />
                    <input type="hidden" name="durationMs" value={5000} />
                    <Button
                      type="submit"
                      size="icon-sm"
                      disabled={!previewRoundQuestionId}
                      title="Show lên (đổi câu đang live)"
                      aria-label="Show lên (đổi câu đang live)"
                    >
                      <Eye />
                    </Button>
                  </form>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-background p-4">
                <details className="mb-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Debug danh sách câu theo vòng
                  </summary>
                  <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                    <p>
                      current_round_type: <span className="font-mono">{liveSession?.current_round_type ?? '—'}</span>
                      {' '}· current_round_id: <span className="font-mono">{liveSession?.current_round_id ?? '—'}</span>
                      {' '}· total RQ: <span className="font-mono">{roundQuestions.length}</span>
                      {' '}· RQ in current round: <span className="font-mono">{currentRoundQuestions.length}</span>
                    </p>
                    {questionsByRoundTypeEntries.length === 0 ? (
                      <p>(Không có round_questions)</p>
                    ) : (
                      <div className="space-y-1">
                        {questionsByRoundTypeEntries.map((entry) => (
                          <p key={entry.roundType}>
                            <span className="font-mono">{entry.roundType}</span>
                            {': '}
                            {entry.codes.join(', ')}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </details>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {previewQuestionCode ? `Mã: ${previewQuestionCode}` : null}
                    {previewQuestionCode ? ' · ' : ''}
                    {liveSession?.current_round_question_id ? `Live RQ: ${liveSession.current_round_question_id}` : 'Chưa show câu'}
                    {previewRoundQuestionId && previewRoundQuestionId !== liveSession?.current_round_question_id ? ` · Đang xem: ${previewRoundQuestionId}` : ''}
                  </p>
                  {winnerBuzz ? (
                    <p className="text-xs text-muted-foreground">
                      Winner: Ghế {normalizePlayerSummary(winnerBuzz.match_players)?.seat_index ?? '—'}
                    </p>
                  ) : null}
                </div>

                <p className="mt-3 whitespace-pre-wrap text-lg font-semibold leading-relaxed">
                  {previewQuestionText ?? (previewRoundQuestion ? `ID: ${getRoundQuestionLabel(previewRoundQuestion as unknown as RoundQuestionRow)}` : 'Chưa có nội dung câu hỏi')}
                </p>

                {previewAnswerText ? (
                  <div className="mt-4 rounded-md border bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">Đáp án</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{previewAnswerText}</p>
                    {previewNoteText ? (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">Ghi chú: {previewNoteText}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Câu trả lời</CardTitle>
              <CardDescription>
                Câu trả lời của thí sinh cho câu đang live. Chấm điểm được đặt ở đây (4 thí sinh), và sẽ tự disable theo luật.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!liveSession?.current_round_question_id ? (
                <p className="text-sm text-muted-foreground">Chưa show câu hỏi.</p>
              ) : (
                (() => {
                  const latestByPlayer = new Map<string, RecentAnswerRow>()
                  for (const a of recentAnswers) {
                    if (!a.player_id) continue
                    if (!latestByPlayer.has(a.player_id)) {
                      latestByPlayer.set(a.player_id, a)
                    }
                  }

                  const enabledScoringPlayerId = (() => {
                    if (!isKhoiDong) return null
                    if (currentRoundQuestion?.target_player_id) return currentRoundQuestion.target_player_id
                    return winnerBuzz?.player_id ?? null
                  })()

                  const scoringHint = (() => {
                    if (!isKhoiDong) return 'Chỉ triển khai đầy đủ logic chấm cho Vòng 1 ở giai đoạn này.'
                    if (currentRoundQuestion?.target_player_id) {
                      const p = players.find((x) => x.id === currentRoundQuestion.target_player_id)
                      return `Khởi động · Thi riêng: chỉ chấm cho Ghế ${p?.seat_index ?? '—'}. (Sai/Hết giờ: 0 điểm)`
                    }
                    return winnerBuzz?.player_id
                      ? 'Khởi động · Thi chung: chỉ chấm cho thí sinh bấm chuông thắng. (Sai/Hết giờ: -5, không âm)'
                      : 'Khởi động · Thi chung: chờ thí sinh bấm chuông thắng để chấm.'
                  })()

                  return (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">{scoringHint}</p>
                      <div className="grid gap-2">
                        {players.map((pl) => {
                          const latest = latestByPlayer.get(pl.id) ?? null
                          const canScore = Boolean(liveSession?.id && enabledScoringPlayerId && enabledScoringPlayerId === pl.id)
                          const seatText = pl.seat_index != null ? `Ghế ${pl.seat_index}` : 'Ghế —'
                          const nameText = pl.display_name ? ` · ${pl.display_name}` : ''

                          const correctLabel = isKhoiDong && currentRoundQuestion?.target_player_id ? 'Đúng (+10)' : 'Đúng (+10)'
                          const wrongLabel = isKhoiDong && currentRoundQuestion?.target_player_id ? 'Sai (0)' : 'Sai (-5)'
                          const timeoutLabel = isKhoiDong && currentRoundQuestion?.target_player_id ? 'Hết giờ (0)' : 'Hết giờ (-5)'

                          return (
                            <div key={pl.id} className="rounded-md border bg-background p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium">
                                  {seatText}
                                  {nameText}
                                </p>

                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={latest?.is_correct ? 'default' : 'outline'}>
                                    {latest?.is_correct == null ? '—' : latest.is_correct ? 'Đúng' : 'Sai'}
                                  </Badge>
                                  <Badge variant="secondary">+{latest?.points_awarded ?? 0}</Badge>
                                </div>
                              </div>

                              <p className="mt-2 whitespace-pre-wrap text-sm">
                                {latest?.answer_text?.trim() ? latest.answer_text : <span className="text-muted-foreground">(Chưa có/Trống)</span>}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <form action={confirmDecisionFormAction}>
                                  <input type="hidden" name="sessionId" value={liveSession?.id ?? ''} />
                                  <input type="hidden" name="playerId" value={pl.id} />
                                  <input type="hidden" name="decision" value="correct" />
                                  <Button type="submit" size="sm" disabled={!canScore} title={correctLabel} aria-label={correctLabel}>
                                    {correctLabel}
                                  </Button>
                                </form>
                                <form action={confirmDecisionFormAction}>
                                  <input type="hidden" name="sessionId" value={liveSession?.id ?? ''} />
                                  <input type="hidden" name="playerId" value={pl.id} />
                                  <input type="hidden" name="decision" value="wrong" />
                                  <Button type="submit" size="sm" variant="outline" disabled={!canScore} title={wrongLabel} aria-label={wrongLabel}>
                                    {wrongLabel}
                                  </Button>
                                </form>
                                <form action={confirmDecisionFormAction}>
                                  <input type="hidden" name="sessionId" value={liveSession?.id ?? ''} />
                                  <input type="hidden" name="playerId" value={pl.id} />
                                  <input type="hidden" name="decision" value="timeout" />
                                  <Button type="submit" size="sm" variant="outline" disabled={!canScore} title={timeoutLabel} aria-label={timeoutLabel}>
                                    {timeoutLabel}
                                  </Button>
                                </form>
                              </div>

                              {latest?.submitted_at ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {new Date(latest.submitted_at).toLocaleTimeString('vi-VN')}
                                </p>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <form action={undoLastScoreChangeFormAction} className="flex items-center justify-end gap-2">
                          <input type="hidden" name="matchId" value={match.id} />
                          <input type="hidden" name="reason" value="" />
                          <Button type="submit" size="icon-sm" variant="outline" title="Undo" aria-label="Undo">
                            <Undo2 />
                          </Button>
                        </form>
                      </div>
                    </div>
                  )
                })()
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Điều khiển</CardTitle>
              <CardDescription>Chọn vòng, chọn thí sinh (tuỳ vòng), chọn câu và thao tác nhanh.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <HostRoundControls
                matchId={match.id}
                rounds={rounds}
                players={players}
                allowTargetSelection={allowTargetSelection}
                currentRoundQuestionId={liveSession?.current_round_question_id ?? null}
                currentTargetPlayerId={currentRoundQuestion?.target_player_id ?? null}
                isKhoiDong={isKhoiDong}
                currentRoundType={liveSession?.current_round_type}
                currentQuestionState={liveSession?.question_state}
                buzzerEnabled={liveSession?.buzzer_enabled ?? null}
              />

              {allowTargetSelection ? (
                <div className="grid gap-2">
                  {isVeDich ? (
                    <div className="grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <form action={setVeDichQuestionValueFormAction} className="flex gap-2">
                          <input type="hidden" name="matchId" value={match.id} />
                          <input type="hidden" name="roundQuestionId" value={liveSession!.current_round_question_id} />
                          <select
                            name="value"
                            defaultValue={veDichValueText}
                            className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                            aria-label="Giá trị câu"
                          >
                            <option value="">20/30</option>
                            <option value="20">20</option>
                            <option value="30">30</option>
                          </select>
                          <Button type="submit" size="icon-sm" title="Lưu giá trị" aria-label="Lưu giá trị" variant="outline">
                            <Check />
                          </Button>
                        </form>

                        <form action={toggleStarUseFormAction} className="flex justify-end">
                          <input type="hidden" name="matchId" value={match.id} />
                          <input type="hidden" name="roundQuestionId" value={liveSession!.current_round_question_id} />
                          <input type="hidden" name="playerId" value={currentRoundQuestion?.target_player_id ?? ''} />
                          {isStarEnabled ? null : <input type="hidden" name="enabled" value="1" />}
                          <Button
                            type="submit"
                            size="icon-sm"
                            variant={isStarEnabled ? 'default' : 'outline'}
                            disabled={!currentRoundQuestion?.target_player_id}
                            title={isStarEnabled ? 'Tắt Star' : 'Bật Star'}
                            aria-label={isStarEnabled ? 'Tắt Star' : 'Bật Star'}
                          >
                            <Sparkles />
                          </Button>
                        </form>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <form action={openStealWindowFormAction}>
                          <input type="hidden" name="matchId" value={match.id} />
                          <input type="hidden" name="durationMs" value={5000} />
                          <Button type="submit" size="icon-sm" variant="outline" title="Mở cửa cướp (5s)" aria-label="Mở cửa cướp (5s)">
                            <Hand />
                          </Button>
                        </form>
                        <form action={confirmVeDichMainDecisionFormAction} className="flex gap-1">
                          <input type="hidden" name="sessionId" value={liveSession!.id} />
                          <Button type="submit" size="icon-sm" name="decision" value="correct" title="Chính: Đúng" aria-label="Chính: Đúng">
                            <Check />
                          </Button>
                          <Button type="submit" size="icon-sm" name="decision" value="wrong" variant="outline" title="Chính: Sai" aria-label="Chính: Sai">
                            <X />
                          </Button>
                          <Button type="submit" size="icon-sm" name="decision" value="timeout" variant="outline" title="Chính: Hết giờ" aria-label="Chính: Hết giờ">
                            <Timer />
                          </Button>
                        </form>
                        <form action={confirmVeDichStealDecisionFormAction} className="flex gap-1">
                          <input type="hidden" name="sessionId" value={liveSession!.id} />
                          <Button type="submit" size="icon-sm" name="decision" value="correct" title="Cướp: Đúng" aria-label="Cướp: Đúng" variant="secondary">
                            <Check />
                          </Button>
                          <Button type="submit" size="icon-sm" name="decision" value="wrong" title="Cướp: Sai (phạt 1/2)" aria-label="Cướp: Sai (phạt 1/2)" variant="outline">
                            <X />
                          </Button>
                          <Button type="submit" size="icon-sm" name="decision" value="timeout" title="Cướp: Hết giờ" aria-label="Cướp: Hết giờ" variant="outline">
                            <Timer />
                          </Button>
                        </form>
                      </div>
                    </div>
                  ) : null}

                  {liveSession?.current_round_type === 'tang_toc' ? (
                    <form action={autoScoreTangTocFormAction} className="flex justify-end">
                      <input type="hidden" name="sessionId" value={liveSession?.id ?? ''} />
                      <Button type="submit" size="icon-sm" variant="outline" disabled={!liveSession?.id} title="Chấm tự động Tăng tốc" aria-label="Chấm tự động Tăng tốc">
                        <Check />
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}

              {/* Chấm điểm đã chuyển qua card "Câu trả lời" để giảm rối UI */}

              {liveSession?.status !== 'running' ? (
                <p className="text-xs text-muted-foreground">Cần mở phòng (running) để đổi vòng/trạng thái câu.</p>
              ) : liveSession?.join_code ? (
                <p className="text-xs text-muted-foreground">Mã phòng: <span className="font-mono">{liveSession.join_code}</span></p>
              ) : null}
            </CardContent>
          </Card>

          {scores.length > 0 ? (
            <LiveScoreboard matchId={match.id} scores={scores} title="Xếp hạng" description="" />
          ) : null}
        </div>
      </div>
    </section>
  )
}
