import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HostRoundControls } from '@/components/olympia/admin/matches/HostRoundControls'
import { HostAutoSync } from '@/components/olympia/admin/matches/HostAutoSync'
import { LiveScoreboard } from '@/components/olympia/admin/matches/LiveScoreboard'
import { InitializeRoundsButton } from '@/components/olympia/admin/matches/InitializeRoundsButton'
import { HostAutoAdvancePersonalKhoiDong } from '@/components/olympia/admin/matches/HostAutoAdvancePersonalKhoiDong'
import { HostRealtimeEventsListener } from '@/components/olympia/admin/matches/HostRealtimeEventsListener'
import { HostQuestionPreviewCard } from '@/components/olympia/admin/matches/HostQuestionPreviewCard'
import { HostQuickScorePanel } from '@/components/olympia/admin/matches/HostQuickScorePanel'
import { getServerAuthContext } from '@/lib/server-auth'
import { resolveDisplayNamesForUserIds } from '@/lib/olympia-display-names'
import {
  ArrowLeft,
  Check,
  Hand,
  Sparkles,
  Timer,
  Undo2,
  X,
} from 'lucide-react'
import {
  autoScoreTangTocFormAction,
  confirmDecisionAndAdvanceFormAction,
  confirmDecisionVoidFormAction,
  confirmObstacleGuessFormAction,
  confirmVcnvRowDecisionFormAction,
  confirmVeDichMainDecisionFormAction,
  confirmVeDichStealDecisionFormAction,
  openStealWindowFormAction,
  selectVeDichPackageFormAction,
  setCurrentQuestionFormAction,
  startSessionTimerFormAction,
  setLiveSessionRoundAction,
  setRoundQuestionTargetPlayerAction,
  setScoreboardOverlayAction,
  setBuzzerEnabledAction,
  setVeDichQuestionValueFormAction,
  setWaitingScreenAction,
  setGuestMediaControlAction,
  resetMatchScoresAction,
  submitObstacleGuessByHostFormAction,
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
  image_url: string | null
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

type VcnvAnswerSummaryRow = {
  id: string
  round_question_id: string
  is_correct: boolean | null
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
  questions?:
  | { image_url?: string | null; audio_url?: string | null }
  | Array<{ image_url?: string | null; audio_url?: string | null }>
  | null
  question_set_items?:
  | { image_url?: string | null; audio_url?: string | null }
  | Array<{ image_url?: string | null; audio_url?: string | null }>
  | null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
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

function getVeDichCodeInfo(code: string | null): { seat: number; index: number } | null {
  if (!code) return null
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) return null
  const m = /^VD-?(\d+)\.(\d+)/i.exec(trimmed)
  if (!m) return null
  const seat = Number(m[1])
  const index = Number(m[2])
  if (!Number.isFinite(seat) || !Number.isFinite(index)) return null
  return { seat, index }
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

  // 1) Nếu là UUID: ưu tiên coi là matchId, nhưng fallback nếu thực tế là sessionId.
  if (isUuid(matchCode)) {
    const { data: matchDirect, error: matchDirectError } = await olympia
      .from('matches')
      .select('id, name, status')
      .eq('id', matchCode)
      .maybeSingle()
    if (matchDirectError) throw matchDirectError
    if (matchDirect) {
      realMatchId = matchDirect.id
    } else {
      // Fallback: treat UUID as live_sessions.id (nhiều người copy nhầm), hoặc join_code (trường hợp join_code dạng UUID).
      const { data: sessionByIdOrJoin, error: sessionByIdOrJoinError } = await olympia
        .from('live_sessions')
        .select('match_id')
        .or(`id.eq.${matchCode},join_code.eq.${matchCode}`)
        .maybeSingle()
      if (sessionByIdOrJoinError) throw sessionByIdOrJoinError
      realMatchId = sessionByIdOrJoin?.match_id ?? null
    }
  } else {
    // 2) Nếu không phải UUID: coi là join_code.
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
      .select('id, match_id, status, join_code, question_state, current_round_type, current_round_id, current_round_question_id, timer_deadline, requires_player_password, buzzer_enabled, show_scoreboard_overlay')
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

  const participantIds = (players ?? [])
    .map((p) => (p as { participant_id?: string | null }).participant_id ?? null)
    .filter((id): id is string => Boolean(id))
  const resolvedNameMap = await resolveDisplayNamesForUserIds(supabase, participantIds)
  const normalizedPlayers = (players ?? []).map((p) => {
    const row = p as { participant_id?: string | null; display_name?: string | null }
    const pid = row.participant_id ?? null
    const resolved = pid ? resolvedNameMap.get(pid) ?? null : null
    return {
      ...p,
      display_name: row.display_name ?? resolved,
    }
  })

  const scoreLookup = new Map<string, number>()
  for (const s of scores ?? []) {
    const prev = scoreLookup.get(s.player_id) ?? 0
    scoreLookup.set(s.player_id, prev + (s.points ?? 0))
  }

  const roundIds = (rounds ?? []).map((r) => r.id)
  const { data: roundQuestions } = roundIds.length
    ? await olympia
      .from('round_questions')
      .select(
        'id, match_round_id, order_index, question_id, question_set_item_id, target_player_id, meta, question_text, answer_text, note, questions(image_url, audio_url), question_set_items(image_url, audio_url)'
      )
      .in('match_round_id', roundIds)
      .order('match_round_id', { ascending: true })
      .order('order_index', { ascending: true })
      .order('id', { ascending: true })
    : { data: [] }

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
  let vcnvAnswerSummary: VcnvAnswerSummaryRow[] = []
  if (liveSession?.current_round_type === 'vcnv' && liveSession.current_round_id) {
    const { data: obstacleRow } = await olympia
      .from('obstacles')
      .select('id, match_round_id, title, image_url')
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

      const relatedRqIds = obstacleTiles.map((t) => t.round_question_id).filter((id): id is string => Boolean(id))
      if (relatedRqIds.length > 0) {
        const { data: answerSummary } = await olympia
          .from('answers')
          .select('id, round_question_id, is_correct')
          .eq('match_id', realMatchId)
          .in('round_question_id', relatedRqIds)
        vcnvAnswerSummary = (answerSummary as unknown as VcnvAnswerSummaryRow[] | null) ?? []
      }
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
    players: normalizedPlayers,
    scores: normalizedPlayers.map((p) => ({
      playerId: p.id,
      displayName:
        (p.display_name ??
          resolvedNameMap.get((p as { participant_id?: string | null }).participant_id ?? '') ??
          null) ??
        `Ghế ${p.seat_index}`,
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
    vcnvAnswerSummary,
  }
}

export default async function OlympiaHostConsolePage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>
  searchParams?: Promise<{ preview?: string | string[]; kdSeat?: string | string[] }>
}) {
  const { matchId } = await params
  const resolvedSearchParams = (searchParams ? await searchParams : {}) as { preview?: string | string[]; kdSeat?: string | string[] }
  const previewParam = Array.isArray(resolvedSearchParams.preview)
    ? resolvedSearchParams.preview[0]
    : resolvedSearchParams.preview

  const kdSeatParamRaw = Array.isArray(resolvedSearchParams.kdSeat)
    ? resolvedSearchParams.kdSeat[0]
    : resolvedSearchParams.kdSeat
  const kdSeat = (() => {
    if (!kdSeatParamRaw) return null
    const n = Number.parseInt(String(kdSeatParamRaw), 10)
    return Number.isFinite(n) ? n : null
  })()

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
    obstacle,
    obstacleTiles,
    obstacleGuesses,
    vcnvAnswerSummary,
  } = data

  const roundTypeByRoundId = new Map<string, string | null>()
  for (const r of rounds) {
    roundTypeByRoundId.set(r.id, r.round_type)
  }
  const currentRoundId = liveSession?.current_round_id
  const currentRoundQuestions = currentRoundId
    ? roundQuestions.filter((q) => q.match_round_id === currentRoundId)
    : roundQuestions
  const statusClass = statusVariants[match.status] ?? 'bg-slate-100 text-slate-700'

  const questionsByRoundType = new Map<string, string[]>()
  for (const q of roundQuestions) {
    const roundType = roundTypeByRoundId.get((q as unknown as RoundQuestionRow).match_round_id) ?? null
    const key = roundType ?? 'unknown'
    const label = getRoundQuestionLabel(q as unknown as RoundQuestionRow)
    const list = questionsByRoundType.get(key) ?? []
    list.push(label)
    questionsByRoundType.set(key, list)
  }
  const questionsByRoundTypeEntries = Array.from(questionsByRoundType.entries())
    .map(([roundType, codes]) => ({ roundType, codes }))
    .sort((a, b) => a.roundType.localeCompare(b.roundType))

  const selectedTargetPlayerId = currentRoundQuestion?.target_player_id ?? null

  const isKhoiDong = liveSession?.current_round_type === 'khoi_dong'
  const isVcnv = liveSession?.current_round_type === 'vcnv'
  const isTangToc = liveSession?.current_round_type === 'tang_toc'
  const isVeDich = liveSession?.current_round_type === 've_dich'
  const allowTargetSelection = Boolean(isKhoiDong || isVeDich)

  // Khởi động: xác định thi riêng/thi chung theo mã câu (KD{seat}- / DKA-), không phụ thuộc target_player_id.
  const khoiDongCodeInfoLive = isKhoiDong
    ? getKhoiDongCodeInfo(getMetaCode((currentRoundQuestion as unknown as RoundQuestionRow | null)?.meta ?? null))
    : null

  const resolvePlayerIdBySeat = (seat: number) => {
    // Thường seat_index là 1..4. Fallback seat-1 để tránh trường hợp DB lưu 0..3.
    return (
      players.find((p) => p.seat_index === seat)?.id ??
      players.find((p) => p.seat_index === seat - 1)?.id ??
      null
    )
  }

  const khoiDongPersonalSeat =
    khoiDongCodeInfoLive && khoiDongCodeInfoLive.kind === 'personal' ? khoiDongCodeInfoLive.seat : null
  const khoiDongPersonalPlayerId =
    typeof khoiDongPersonalSeat === 'number' ? resolvePlayerIdBySeat(khoiDongPersonalSeat) : null

  const filteredCurrentRoundQuestions = (() => {
    if (!isKhoiDong) return currentRoundQuestions

    // Lọc theo luật mã câu:
    // - Thi chung: DKA-
    // - Thi riêng: KD{seat}-
    if (typeof kdSeat === 'number') {
      const prefix = `KD${kdSeat}-`
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

  const previewRoundQuestionId =
    previewParam && filteredCurrentRoundQuestions.some((q) => q.id === previewParam)
      ? previewParam
      : liveSession?.current_round_question_id && filteredCurrentRoundQuestions.some((q) => q.id === liveSession.current_round_question_id)
        ? liveSession.current_round_question_id
        : null

  const veDichValueRaw =
    currentRoundQuestion?.meta && typeof currentRoundQuestion.meta === 'object'
      ? (currentRoundQuestion.meta as Record<string, unknown>).ve_dich_value
      : undefined
  const veDichValue = typeof veDichValueRaw === 'number' ? veDichValueRaw : veDichValueRaw ? Number(veDichValueRaw) : undefined
  const veDichValueText = veDichValue === 20 || veDichValue === 30 ? String(veDichValue) : ''

  const veDichOrder = (() => {
    const scoreByPlayerId = new Map<string, number>()
    for (const s of scores) scoreByPlayerId.set(s.playerId, s.totalScore ?? 0)
    return players
      .slice()
      .sort((a, b) => {
        const sa = scoreByPlayerId.get(a.id) ?? 0
        const sb = scoreByPlayerId.get(b.id) ?? 0
        if (sb !== sa) return sb - sa
        // Tie-break: vị trí đứng/ghế
        return (a.seat_index ?? 999) - (b.seat_index ?? 999)
      })
      .map((p) => ({
        playerId: p.id,
        seat: p.seat_index ?? null,
        name: p.display_name,
        score: scoreByPlayerId.get(p.id) ?? 0,
      }))
  })()

  const veDichPackageByPlayerId = (() => {
    if (!liveSession?.current_round_id) return new Map<string, 20 | 30 | null>()
    const rqInVeDich = roundQuestions.filter((q) => q.match_round_id === liveSession.current_round_id)
    const bySeat = new Map<number, Array<RoundQuestionRow>>()
    for (const q of rqInVeDich) {
      const code = getMetaCode((q as unknown as RoundQuestionRow).meta)
      const info = getVeDichCodeInfo(code)
      if (!info) continue
      const list = bySeat.get(info.seat) ?? []
      list.push(q as unknown as RoundQuestionRow)
      bySeat.set(info.seat, list)
    }

    const out = new Map<string, 20 | 30 | null>()
    for (const p of players) {
      if (typeof p.seat_index !== 'number') {
        out.set(p.id, null)
        continue
      }
      const list = (bySeat.get(p.seat_index) ?? []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      const values = list
        .map((rq) => {
          const raw = rq.meta && typeof rq.meta === 'object' ? (rq.meta as Record<string, unknown>).ve_dich_value : undefined
          const v = typeof raw === 'number' ? raw : raw ? Number(raw) : NaN
          return v === 20 || v === 30 ? v : null
        })
        .filter((v): v is 20 | 30 => v === 20 || v === 30)

      if (values.length === 0) {
        out.set(p.id, null)
        continue
      }
      const first = values[0]
      const allSame = values.every((v) => v === first)
      out.set(p.id, allSame ? first : first)
    }
    return out
  })()

  const nextVeDichChooserPlayerId = (() => {
    for (const p of veDichOrder) {
      if (!p.playerId) continue
      const v = veDichPackageByPlayerId.get(p.playerId) ?? null
      if (v == null) return p.playerId
    }
    return null
  })()

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
          <HostQuestionPreviewCard
            matchId={match.id}
            liveSession={liveSession ? {
              id: liveSession.id ?? null,
              status: liveSession.status ?? null,
              question_state: liveSession.question_state ?? null,
              current_round_type: liveSession.current_round_type ?? null,
              current_round_id: liveSession.current_round_id ?? null,
              current_round_question_id: liveSession.current_round_question_id ?? null,
            } : null}
            descriptionText={(() => {
              if (!liveSession?.current_round_type) return 'Chưa chọn vòng'
              const roundText = roundLabelMap[liveSession.current_round_type] ?? liveSession.current_round_type
              if (!allowTargetSelection) return roundText
              if (isKhoiDong) {
                return typeof kdSeat === 'number'
                  ? `${roundText} · Thi riêng · Ghế ${kdSeat}`
                  : `${roundText} · Thi chung`
              }
              if (selectedTargetPlayerId) {
                const p = players.find((x) => x.id === selectedTargetPlayerId)
                const label = p?.display_name ?? (p?.seat_index != null ? `Ghế ${p.seat_index}` : 'Thí sinh')
                return `${roundText} · Thí sinh: ${label}`
              }
              return roundText
            })()}
            options={filteredCurrentRoundQuestions.map((q) => ({
              id: q.id,
              label: `#${q.order_index ?? '?'} · ${getRoundQuestionLabel(q as unknown as RoundQuestionRow)}`,
            }))}
            questions={filteredCurrentRoundQuestions as unknown as import('@/components/olympia/admin/matches/HostQuestionPreviewCard').HostPreviewRoundQuestion[]}
            initialPreviewId={previewRoundQuestionId}
            triggerReset={liveSession?.current_round_question_id === null}
            questionsDebug={{
              totalRoundQuestions: roundQuestions.length,
              currentRoundQuestionsCount: currentRoundQuestions.length,
              currentRoundType: liveSession?.current_round_type ?? null,
              currentRoundId: liveSession?.current_round_id ?? null,
              byRoundType: questionsByRoundTypeEntries,
            }}
            winnerBuzz={winnerBuzz}
            setCurrentQuestionFormAction={setCurrentQuestionFormAction}
            setGuestMediaControlAction={setGuestMediaControlAction}
          />

          {isVcnv && obstacle ? (
            (() => {
              const byPos = new Map<number, HostObstacleTileRow>()
              for (const t of obstacleTiles) {
                if (typeof t.position_index === 'number') byPos.set(t.position_index, t)
              }

              const getRq = (rqId: string | null) => {
                if (!rqId) return null
                return (
                  roundQuestions.find((q) => (q as unknown as RoundQuestionRow).id === rqId) as unknown as RoundQuestionRow | undefined
                ) ?? null
              }

              const normalizeWord = (text: string | null | undefined) => {
                const raw = (text ?? '').trim()
                if (!raw) return ''
                return raw
              }

              const buildBoxes = (answerText: string, reveal: boolean) => {
                const chars = Array.from(answerText)
                return (
                  <div className="flex flex-wrap gap-1">
                    {chars.map((ch, idx) => {
                      if (ch === ' ') {
                        return <span key={idx} className="w-2" />
                      }
                      const show = reveal ? ch.toUpperCase() : ''
                      return (
                        <span
                          key={idx}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border bg-white text-sm font-semibold"
                          aria-label={reveal ? show : 'Ô chữ'}
                        >
                          {show}
                        </span>
                      )
                    })}
                  </div>
                )
              }

              const computeTileStatus = (tile: HostObstacleTileRow | null) => {
                if (!tile?.round_question_id) return { attempted: false, anyCorrect: false, locked: false }
                const rows = vcnvAnswerSummary.filter((a) => a.round_question_id === tile.round_question_id)
                // Chỉ coi là "đã có kết quả" khi host đã chấm (is_correct != null).
                const attempted = rows.some((r) => r.is_correct != null)
                const anyCorrect = rows.some((r) => r.is_correct === true)
                const locked = attempted && !anyCorrect && tile.is_open === false
                return { attempted, anyCorrect, locked }
              }

              const tilesForImage: Array<{ pos: number; label: string; className: string }> = [
                { pos: 1, label: '1', className: 'left-2 top-2' },
                { pos: 2, label: '2', className: 'right-2 top-2' },
                { pos: 3, label: '3', className: 'left-2 bottom-2' },
                { pos: 4, label: '4', className: 'right-2 bottom-2' },
                { pos: 5, label: 'TT', className: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' },
              ]

              const renderRow = (pos: number, title: string) => {
                const tile = byPos.get(pos) ?? null
                const rq = getRq(tile?.round_question_id ?? null)
                const answer = normalizeWord(rq?.answer_text)
                const { locked } = computeTileStatus(tile)
                const reveal = Boolean(tile?.is_open)

                return (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{title}</p>
                      <p className="text-xs text-muted-foreground">{reveal ? 'Mở' : locked ? 'Đóng' : 'Chưa mở'}</p>
                    </div>
                    {answer ? buildBoxes(answer, reveal) : <p className="text-xs text-muted-foreground">(Chưa có đáp án)</p>}
                  </div>
                )
              }

              return (
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground mb-3">
                    VCNV: 4 hàng ngang + 1 ô trung tâm. Ô chữ sẽ hiện khi hàng được mở.
                  </p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="relative overflow-hidden rounded-md border bg-slate-50">
                        {obstacle.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={obstacle.image_url}
                            alt={obstacle.title ?? 'Chướng ngại vật'}
                            className="h-64 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-64 w-full items-center justify-center text-sm text-muted-foreground">
                            (Chưa có ảnh CNV)
                          </div>
                        )}

                        {tilesForImage.map((t) => {
                          const tile = byPos.get(t.pos) ?? null
                          const { locked } = computeTileStatus(tile)
                          const hidden = Boolean(tile?.is_open)
                          if (hidden) return null
                          return (
                            <div
                              key={t.pos}
                              className={`absolute ${t.className} flex h-16 w-16 items-center justify-center rounded-md border ${locked ? 'bg-slate-200' : 'bg-slate-100'}`}
                              aria-label={locked ? `Ô ${t.label} (đóng)` : `Ô ${t.label} (che)`}
                            >
                              <span className="text-sm font-semibold text-slate-700">{t.label}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {renderRow(1, 'Hàng 1')}
                      {renderRow(2, 'Hàng 2')}
                      {renderRow(3, 'Hàng 3')}
                      {renderRow(4, 'Hàng 4')}
                      {renderRow(5, 'Trung tâm')}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-md border bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-700">Chuông đoán CNV (miệng)</p>
                      <form action={submitObstacleGuessByHostFormAction} className="mt-2 flex flex-wrap gap-2">
                        <input type="hidden" name="sessionId" value={liveSession?.id ?? ''} />
                        <select
                          name="playerId"
                          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          aria-label="Chọn thí sinh đoán CNV"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Chọn thí sinh…
                          </option>
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              Ghế {p.seat_index}{p.display_name ? ` · ${p.display_name}` : ''}
                            </option>
                          ))}
                        </select>
                        <input
                          name="guessText"
                          className="flex-1 min-w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          placeholder="Nhập từ khóa CNV…"
                          aria-label="Từ khóa CNV"
                        />
                        <Button type="submit" size="sm" className="h-9">
                          Ghi nhận
                        </Button>
                      </form>
                    </div>

                    {obstacleGuesses.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Lượt đoán CNV gần đây</p>
                        <div className="grid gap-2">
                          {obstacleGuesses.map((g) => {
                            const seat = normalizePlayerSummary(g.match_players)?.seat_index
                            const statusText = g.is_correct ? 'Đúng' : 'Chưa xác nhận/Sai'
                            return (
                              <div key={g.id} className="rounded-md border bg-background p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-medium">Ghế {seat ?? '—'}</p>
                                  <Badge variant={g.is_correct ? 'default' : 'outline'}>{statusText}</Badge>
                                </div>
                                <p className="mt-2 text-sm font-semibold">{g.guess_text}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <form action={confirmObstacleGuessFormAction}>
                                    <input type="hidden" name="guessId" value={g.id} />
                                    <input type="hidden" name="decision" value="correct" />
                                    <Button type="submit" size="sm" disabled={g.is_correct} title="Xác nhận đúng" aria-label="Xác nhận đúng">
                                      <Check className="h-4 w-4 mr-1" />
                                      Đúng
                                    </Button>
                                  </form>
                                  <form action={confirmObstacleGuessFormAction}>
                                    <input type="hidden" name="guessId" value={g.id} />
                                    <input type="hidden" name="decision" value="wrong" />
                                    <Button type="submit" size="sm" variant="outline" disabled={g.is_correct} title="Xác nhận sai (loại quyền CNV)" aria-label="Xác nhận sai (loại quyền CNV)">
                                      <X className="h-4 w-4 mr-1" />
                                      Sai
                                    </Button>
                                  </form>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })()
          ) : null}

          {(isKhoiDong || isVeDich) ? (
            (() => {
              const hasLiveQuestion = Boolean(liveSession?.id && liveSession?.current_round_question_id)
              const enabledScoringPlayerId = (() => {
                if (!hasLiveQuestion) return null
                if (isKhoiDong) {
                  // Ưu tiên xác định thi riêng theo mã câu KD{seat}-.
                  if (khoiDongPersonalPlayerId) return khoiDongPersonalPlayerId
                  if (currentRoundQuestion?.target_player_id) return currentRoundQuestion.target_player_id
                  return winnerBuzz?.player_id ?? null
                }
                if (isVeDich) {
                  return currentRoundQuestion?.target_player_id ?? null
                }
                return null
              })()

              const durationMs = (() => {
                if (isKhoiDong) return 5000
                if (isVeDich) return veDichValue === 30 ? 20000 : 15000
                return 5000
              })()

              const disabled = !enabledScoringPlayerId
              const hint = (() => {
                if (!hasLiveQuestion) {
                  return 'Bạn đang xem câu (preview). Hãy bấm Show để bắt đầu chấm nhanh.'
                }
                if (isKhoiDong && khoiDongPersonalSeat != null && !khoiDongPersonalPlayerId) {
                  return `Khởi động thi riêng (KD${khoiDongPersonalSeat}): không tìm thấy thí sinh ghế ${khoiDongPersonalSeat}.`
                }
                if (isKhoiDong && !enabledScoringPlayerId) return 'Khởi động thi chung: cần có thí sinh bấm chuông thắng.'
                if (isVeDich && !enabledScoringPlayerId) return 'Về đích: cần chọn thí sinh chính trước.'
                return 'Chấm nhanh (tự trừ điểm và chuyển sang câu tiếp theo).'
              })()

              const scoringPlayerLabel = enabledScoringPlayerId
                ? (() => {
                  const p = players.find((x) => x.id === enabledScoringPlayerId)
                  if (!p) return '—'
                  const seat = p.seat_index != null ? `Ghế ${p.seat_index}` : 'Thí sinh'
                  return p.display_name ? `${seat} · ${p.display_name}` : seat
                })()
                : null

              const showTimeoutButton = Boolean(
                isKhoiDong && khoiDongPersonalSeat != null && liveSession?.question_state === 'showing' && liveSession?.timer_deadline
              )
              const showTimerStartButton = Boolean(
                isKhoiDong && khoiDongPersonalSeat != null && liveSession?.question_state === 'showing' && !liveSession?.timer_deadline
              )

              return (
                <div>
                  {isKhoiDong && khoiDongPersonalSeat != null && liveSession?.question_state === 'showing' && liveSession?.timer_deadline ? (
                    <div className="mb-2">
                      <HostAutoAdvancePersonalKhoiDong deadlineIso={liveSession.timer_deadline} />
                    </div>
                  ) : null}

                  <HostQuickScorePanel
                    hint={hint}
                    scoringPlayerLabel={scoringPlayerLabel}
                    isVeDich={isVeDich}
                    showTimeoutButton={showTimeoutButton}
                    showTimerStartButton={showTimerStartButton}
                    disabled={disabled}
                    roundQuestionId={liveSession?.current_round_question_id ?? null}
                    matchId={match.id}
                    sessionId={liveSession?.id ?? ''}
                    playerId={enabledScoringPlayerId ?? ''}
                    durationMs={durationMs}
                    confirmDecisionAndAdvanceFormAction={confirmDecisionAndAdvanceFormAction}
                    startSessionTimerFormAction={startSessionTimerFormAction}
                    confirmVeDichMainDecisionFormAction={confirmVeDichMainDecisionFormAction}
                  />
                </div>
              )
            })()
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Câu trả lời</CardTitle>
              <CardDescription>
                Câu trả lời của thí sinh cho câu đang live. Chấm điểm được đặt ở đây (4 thí sinh), và sẽ tự disable theo luật.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const latestByPlayer = new Map<string, RecentAnswerRow>()
                for (const a of recentAnswers) {
                  if (!a.player_id) continue
                  if (!latestByPlayer.has(a.player_id)) {
                    latestByPlayer.set(a.player_id, a)
                  }
                }

                const hasLiveQuestion = Boolean(liveSession?.id && liveSession?.current_round_question_id)

                const enabledScoringPlayerId = (() => {
                  if (!hasLiveQuestion) return null
                  if (isKhoiDong) {
                    if (khoiDongPersonalPlayerId) return khoiDongPersonalPlayerId
                    if (currentRoundQuestion?.target_player_id) return currentRoundQuestion.target_player_id
                    return winnerBuzz?.player_id ?? null
                  }
                  if (isVeDich) {
                    return currentRoundQuestion?.target_player_id ?? null
                  }
                  // Các vòng khác: mặc định cho phép chấm cho mọi thí sinh.
                  return null
                })()

                const allowAllPlayers = hasLiveQuestion && !isTangToc && !isKhoiDong && !isVeDich

                const scoringHint = (() => {
                  if (!hasLiveQuestion) return 'Chưa show câu hỏi.'
                  if (isTangToc) return 'Tăng tốc: chấm tự động theo thứ tự thời gian (40/30/20/10).'
                  if (isKhoiDong) {
                    if (khoiDongPersonalSeat != null) {
                      return `Khởi động · Thi riêng: chỉ chấm cho Ghế ${khoiDongPersonalSeat}. (Sai/Hết giờ: 0 điểm)`
                    }
                    return winnerBuzz?.player_id
                      ? 'Khởi động · Thi chung: chỉ chấm cho thí sinh bấm chuông thắng. (Sai/Hết giờ: -5, không âm)'
                      : 'Khởi động · Thi chung: chờ thí sinh bấm chuông thắng để chấm.'
                  }
                  if (isVeDich) {
                    const p = currentRoundQuestion?.target_player_id
                      ? players.find((x) => x.id === currentRoundQuestion.target_player_id)
                      : null
                    return `Về đích: chỉ chấm cho thí sinh chính (Ghế ${p?.seat_index ?? '—'}). Sao: đúng x2, sai bị trừ điểm câu.`
                  }
                  if (isVcnv) return 'VCNV: đúng +10, sai/hết giờ 0.'
                  return 'Chấm điểm theo luật vòng hiện tại.'
                })()

                const getDecisionLabels = (playerId: string) => {
                  if (isKhoiDong) {
                    const isPersonal = Boolean(khoiDongPersonalSeat != null || currentRoundQuestion?.target_player_id)
                    return {
                      correct: 'Đúng (+10)',
                      wrong: isPersonal ? 'Sai (0)' : 'Sai (-5)',
                      timeout: isPersonal ? 'Hết giờ (0)' : 'Hết giờ (-5)',
                    }
                  }

                  if (isVcnv) {
                    return { correct: 'Đúng (+10)', wrong: 'Sai (0)', timeout: 'Hết giờ (0)' }
                  }

                  if (isVeDich) {
                    const base = veDichValue === 20 || veDichValue === 30 ? veDichValue : null
                    const isThisStarEnabled = Boolean(isStarEnabled && selectedTargetPlayerId === playerId)
                    const correctText = base ? `Đúng (+${base * (isThisStarEnabled ? 2 : 1)})` : 'Đúng'
                    const wrongText = base ? (isThisStarEnabled ? `Sai (-${base})` : 'Sai (0)') : 'Sai'
                    const timeoutText = base ? (isThisStarEnabled ? `Hết giờ (-${base})` : 'Hết giờ (0)') : 'Hết giờ'
                    return { correct: correctText, wrong: wrongText, timeout: timeoutText }
                  }

                  return { correct: 'Đúng', wrong: 'Sai', timeout: 'Hết giờ' }
                }

                return (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{scoringHint}</p>
                    <div className="grid gap-2">
                      {players.map((pl) => {
                        const latest = latestByPlayer.get(pl.id) ?? null
                        const canScore = Boolean(
                          hasLiveQuestion &&
                          !isTangToc &&
                          (allowAllPlayers || (enabledScoringPlayerId && enabledScoringPlayerId === pl.id))
                        )
                        const seatText = pl.seat_index != null ? `Ghế ${pl.seat_index}` : 'Ghế —'
                        const nameText = pl.display_name ? ` · ${pl.display_name}` : ''

                        const labels = getDecisionLabels(pl.id)

                        const decisionFormAction = isVcnv
                          ? confirmVcnvRowDecisionFormAction
                          : confirmDecisionVoidFormAction

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

                            <div className="mt-3 grid grid-cols-3 gap-2">
                              <form action={decisionFormAction} className="col-span-1">
                                <input type="hidden" name="sessionId" value={liveSession?.id ?? ''} />
                                <input type="hidden" name="playerId" value={pl.id} />
                                <input type="hidden" name="decision" value="correct" />
                                <Button type="submit" size="lg" className="w-full font-bold text-base disabled:opacity-40" disabled={!canScore} title={labels.correct} aria-label={labels.correct}>
                                  <Check className="w-5 h-5 mr-1" />
                                  Đúng
                                </Button>
                              </form>
                              <form action={decisionFormAction} className="col-span-1">
                                <input type="hidden" name="sessionId" value={liveSession?.id ?? ''} />
                                <input type="hidden" name="playerId" value={pl.id} />
                                <input type="hidden" name="decision" value="wrong" />
                                <Button type="submit" size="lg" variant="outline" className="w-full font-bold text-base disabled:opacity-40" disabled={!canScore} title={labels.wrong} aria-label={labels.wrong}>
                                  <X className="w-5 h-5 mr-1" />
                                  Sai
                                </Button>
                              </form>
                              <form action={decisionFormAction} className="col-span-1">
                                <input type="hidden" name="sessionId" value={liveSession?.id ?? ''} />
                                <input type="hidden" name="playerId" value={pl.id} />
                                <input type="hidden" name="decision" value="timeout" />
                                <Button type="submit" size="lg" variant="outline" className="w-full font-bold text-base disabled:opacity-40" disabled={!canScore} title={labels.timeout} aria-label={labels.timeout}>
                                  Hết giờ
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
              })()}
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
              <HostAutoSync
                sessionId={liveSession?.id ?? null}
                currentRoundType={liveSession?.current_round_type ?? null}
                currentRoundQuestionId={liveSession?.current_round_question_id ?? null}
                questionState={liveSession?.question_state ?? null}
              />

              <HostRealtimeEventsListener
                matchId={match.id}
                sessionId={liveSession?.id ?? null}
                currentRoundQuestionId={liveSession?.current_round_question_id ?? null}
                playerLabelsById={Object.fromEntries(
                  players.map((p) => {
                    const seat = p.seat_index != null ? String(p.seat_index) : '—'
                    const name = p.display_name ? ` · ${p.display_name}` : ''
                    return [p.id, `Ghế ${seat}${name}`]
                  })
                )}
              />

              <HostRoundControls
                matchId={match.id}
                rounds={rounds}
                players={players}
                setLiveSessionRoundAction={setLiveSessionRoundAction}
                setWaitingScreenAction={setWaitingScreenAction}
                setScoreboardOverlayAction={setScoreboardOverlayAction}
                setBuzzerEnabledAction={setBuzzerEnabledAction}
                setRoundQuestionTargetPlayerAction={setRoundQuestionTargetPlayerAction}
                allowTargetSelection={allowTargetSelection}
                currentRoundQuestionId={liveSession?.current_round_question_id ?? null}
                currentTargetPlayerId={currentRoundQuestion?.target_player_id ?? null}
                isKhoiDong={isKhoiDong}
                currentRoundType={liveSession?.current_round_type}
                currentQuestionState={liveSession?.question_state}
                buzzerEnabled={liveSession?.buzzer_enabled ?? null}
                showScoreboardOverlay={liveSession?.show_scoreboard_overlay ?? null}
              />

              {allowTargetSelection ? (
                <div className="grid gap-2">
                  {isVeDich ? (
                    <div className="grid gap-2">
                      <div className="rounded-md border bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-700">Chọn gói Về đích (theo thứ tự)</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Thứ tự thi theo điểm hiện tại (cao → thấp). Chỉ người tiếp theo mới được chọn gói.
                        </p>
                        <div className="mt-3 grid gap-2">
                          {veDichOrder.map((p) => {
                            const pkg = veDichPackageByPlayerId.get(p.playerId) ?? null
                            const isNext = nextVeDichChooserPlayerId === p.playerId
                            const seatText = p.seat != null ? `Ghế ${p.seat}` : 'Ghế —'
                            const nameText = p.name ? ` · ${p.name}` : ''
                            const pkgText = pkg ? `Gói ${pkg}` : 'Chưa chọn'
                            return (
                              <div key={p.playerId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">
                                    {seatText}
                                    {nameText}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">Điểm: {p.score} · {pkgText}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <form action={selectVeDichPackageFormAction}>
                                    <input type="hidden" name="matchId" value={match.id} />
                                    <input type="hidden" name="playerId" value={p.playerId} />
                                    <input type="hidden" name="value" value={20} />
                                    <Button type="submit" size="sm" variant="outline" className="h-8 px-3 text-xs" disabled={!isNext || pkg != null}>
                                      Gói 20
                                    </Button>
                                  </form>
                                  <form action={selectVeDichPackageFormAction}>
                                    <input type="hidden" name="matchId" value={match.id} />
                                    <input type="hidden" name="playerId" value={p.playerId} />
                                    <input type="hidden" name="value" value={30} />
                                    <Button type="submit" size="sm" variant="outline" className="h-8 px-3 text-xs" disabled={!isNext || pkg != null}>
                                      Gói 30
                                    </Button>
                                  </form>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <form action={setVeDichQuestionValueFormAction} className="flex gap-2">
                          <input type="hidden" name="matchId" value={match.id} />
                          <input type="hidden" name="roundQuestionId" value={liveSession?.current_round_question_id ?? ''} />
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
                          <Button
                            type="submit"
                            size="icon-sm"
                            title="Lưu giá trị"
                            aria-label="Lưu giá trị"
                            variant="outline"
                            disabled={!liveSession?.current_round_question_id}
                          >
                            <Check />
                          </Button>
                        </form>

                        <form action={toggleStarUseFormAction} className="flex justify-end">
                          <input type="hidden" name="matchId" value={match.id} />
                          <input type="hidden" name="roundQuestionId" value={liveSession?.current_round_question_id ?? ''} />
                          <input type="hidden" name="playerId" value={currentRoundQuestion?.target_player_id ?? ''} />
                          {isStarEnabled ? null : <input type="hidden" name="enabled" value="1" />}
                          <Button
                            type="submit"
                            size="icon-sm"
                            variant={isStarEnabled ? 'default' : 'outline'}
                            disabled={!liveSession?.current_round_question_id || !currentRoundQuestion?.target_player_id}
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
            <LiveScoreboard
              matchId={match.id}
              scores={scores}
              title="Xếp hạng"
              description=""
              resetScoresAction={resetMatchScoresAction}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}
