'use client'

import type { ReactNode, CSSProperties } from 'react'
import { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus, createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitAnswerAction, triggerBuzzerAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { useOlympiaGameState } from '@/components/olympia/shared/game/useOlympiaGameState'
import { AnswersOverlay } from '@/components/olympia/shared/game/AnswersOverlay'
import type { GameSessionPayload } from '@/types/olympia/game'
import { RefreshCw, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { OlympiaQuestionsPreloadOverlay } from '@/components/olympia/shared/game/OlympiaQuestionsPreloadOverlay'
import {
  createClientTraceId,
  estimateFormDataPayloadBytes,
  traceClient,
} from "@/lib/olympia/olympia-client-trace";
import {
  GameEvent,
  SoundCacheManager,
  SoundController,
  SoundEventRouter,
  SoundRegistry,
} from '@/lib/olympia/sound'
import type { GameEventPayload, RoundType } from '@/lib/olympia/sound'

import { cn } from '@/utils/cn'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

type OlympiaGameClientProps = {
  initialData: GameSessionPayload
  sessionId: string
  allowGuestFallback?: boolean
  viewerMode?: 'player' | 'guest' | 'mc'
  mcScoreboardSlotId?: string
  mcBuzzerSlotId?: string
}

type BuzzerEventLite = {
  id: string | null
  round_question_id: string | null
  player_id: string | null
  event_type: string | null
  result: string | null
  occurred_at: string | null
}

const roundLabel: Record<string, string> = {
  khoi_dong: 'Khởi động',
  vcnv: 'Vượt chướng ngại vật',
  tang_toc: 'Tăng tốc',
  ve_dich: 'Về đích',
  unknown: 'Đang xác định',
}

const questionStateLabel: Record<string, string> = {
  hidden: 'Đang ẩn',
  showing: 'Đang hiển thị',
  answer_revealed: 'Đã mở đáp án',
  completed: 'Đã chấm',
}

const actionInitialState: ActionState = { error: null, success: null }


function FormSubmitButton({ children, disabled, variant }: { children: ReactNode; disabled?: boolean; variant?: 'default' | 'outline' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="flex-1" variant={variant ?? 'default'} disabled={disabled || pending}>
      {pending ? 'Đang gửi…' : children}
    </Button>
  )
}

export function OlympiaGameClient({
  initialData,
  sessionId,
  allowGuestFallback,
  viewerMode,
  mcScoreboardSlotId,
  mcBuzzerSlotId,
}: OlympiaGameClientProps) {
  const {
    match,
    session,
    players,
    scores,
    roundQuestions,
    buzzerEvents,
    answers,
    starUses,
    vcnvRevealByRoundQuestionId,
    vcnvLockedWrongByRoundQuestionId,
    timer,
    timerLabel,
    questionState,
    roundType,
    isRealtimeReady,
    viewerUserId,
    refreshFromServer,
  } = useOlympiaGameState({ sessionId, initialData })

  const submitAnswerActionTraced = useCallback(
    async (prevState: ActionState, formData: FormData): Promise<ActionState> => {
      const traceId = createClientTraceId()
      formData.set('traceId', traceId)
      traceClient({
        traceId,
        action: 'submitAnswerAction',
        event: 'start',
        fields: { sessionId, payloadBytes: estimateFormDataPayloadBytes(formData) },
      })
      const t0 = performance.now()
      const result = await submitAnswerAction(prevState, formData)
      const t1 = performance.now()
      traceClient({
        traceId,
        action: 'submitAnswerAction',
        event: 'end',
        fields: { msAwaitServerAction: Math.round(t1 - t0), ok: !result.error },
      })
      return result
    },
    [sessionId]
  )

  const triggerBuzzerActionTraced = useCallback(
    async (prevState: ActionState, formData: FormData): Promise<ActionState> => {
      const traceId = createClientTraceId()
      formData.set('traceId', traceId)
      traceClient({
        traceId,
        action: 'triggerBuzzerAction',
        event: 'start',
        fields: { sessionId, payloadBytes: estimateFormDataPayloadBytes(formData) },
      })
      const t0 = performance.now()
      const result = await triggerBuzzerAction(prevState, formData)
      const t1 = performance.now()
      traceClient({
        traceId,
        action: 'triggerBuzzerAction',
        event: 'end',
        fields: { msAwaitServerAction: Math.round(t1 - t0), ok: !result.error },
      })
      return result
    },
    [sessionId]
  )

  const [answerState, answerAction] = useActionState(submitAnswerActionTraced, actionInitialState)
  const [buzzerState, buzzerAction] = useActionState(triggerBuzzerActionTraced, actionInitialState)

  const [optimisticBuzzerWinner, setOptimisticBuzzerWinner] = useState<{
    roundQuestionId: string
    playerId: string
    eventType: 'buzz' | 'steal'
    createdAtMs: number
  } | null>(null)

  // Blocking preload overlay (không có nút huỷ)
  // Ưu tiên preload từ initialData để chạy ngay khi mount.
  const preloadRoundQuestions = useMemo(() => initialData.roundQuestions ?? [], [initialData.roundQuestions])

  const veDichNotifiedBySeatRef = useRef<Map<number, string>>(new Map())

  useEffect(() => {
    if (roundType !== 've_dich') {
      veDichNotifiedBySeatRef.current.clear()
      return
    }

    const currentRoundId = session.current_round_id
    if (!currentRoundId) return

    const rqs = roundQuestions.filter((rq) => rq.match_round_id === currentRoundId)
    if (rqs.length === 0) return

    const getSeatFromOrderIndex = (orderIndex: unknown): number | null => {
      const n = typeof orderIndex === 'number' ? orderIndex : Number(orderIndex)
      if (!Number.isFinite(n)) return null
      if (n < 1 || n > 12) return null
      const seat = Math.floor((n - 1) / 3) + 1
      return seat >= 1 && seat <= 4 ? seat : null
    }

    const seatBlocks = new Map<number, typeof rqs>()
    for (const rq of rqs) {
      const seat = getSeatFromOrderIndex(rq.order_index)
      if (!seat) continue
      const list = seatBlocks.get(seat) ?? []
      list.push(rq)
      seatBlocks.set(seat, list)
    }

    for (const [seat, list] of seatBlocks) {
      const top3 = list.slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)).slice(0, 3)
      if (top3.length < 3) continue

      const confirmed = top3.every((rq) => Boolean(rq.question_set_item_id))
      if (!confirmed) continue

      const values = top3.map((rq) => {
        const meta = rq.meta
        const raw = meta && typeof meta === 'object' ? (meta as Record<string, unknown>).ve_dich_value : undefined
        const v = typeof raw === 'number' ? raw : raw ? Number(raw) : NaN
        return v === 20 || v === 30 ? v : null
      })
      if (values.some((v) => v == null)) continue
      const summary = (values as Array<20 | 30>).join('-')

      const last = veDichNotifiedBySeatRef.current.get(seat) ?? null
      if (last === summary) continue
      veDichNotifiedBySeatRef.current.set(seat, summary)

      const ownerPlayerId =
        top3.find((rq) => typeof rq.target_player_id === 'string' && rq.target_player_id)?.target_player_id ?? null
      const owner = ownerPlayerId ? players.find((p) => p.id === ownerPlayerId) ?? null : null
      const ownerName = owner?.display_name ? ` · ${owner.display_name}` : ''

      toast.info(`Ghế ${seat}${ownerName} đã chọn gói Về đích: ${summary}`)
    }
  }, [players, roundQuestions, roundType, session.current_round_id])

  // Toast notifications for feedback
  useEffect(() => {
    const answerFeedback = answerState.error ?? answerState.success
    if (answerFeedback) {
      if (answerState.error) {
        toast.error(answerFeedback)
      } else {
        toast.success(answerFeedback)
      }
    }
  }, [answerState.error, answerState.success])

  useEffect(() => {
    const buzzerFeedback = buzzerState.error ?? buzzerState.success
    if (buzzerFeedback) {
      if (buzzerState.error) {
        toast.error(buzzerFeedback)
      } else {
        toast.success(buzzerFeedback)
      }
    }
  }, [buzzerState.error, buzzerState.success])

  const scoreboard = useMemo(() => {
    const totals = new Map<string, number>()
    for (const score of scores) {
      if (!score.player_id) continue
      const prev = totals.get(score.player_id) ?? 0
      const current = typeof score.points === 'number' ? score.points : 0
      totals.set(score.player_id, prev + current)
    }

    return players
      .map((player) => {
        const id = player.id
        return {
          id,
          name: player.display_name ?? 'Thí sinh',
          seat: player.seat_index,
          total: totals.get(id) ?? 0,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [players, scores])

  const questionTitle = roundLabel[roundType] ?? roundType
  const isVeDich = roundType === 've_dich'
  const isKhoiDong = roundType === 'khoi_dong'
  const isStealWindow = isVeDich && questionState === 'answer_revealed'
  const questionStateText =
    isStealWindow ? 'Cửa sổ cướp' : (questionStateLabel[questionState] ?? questionState)
  const resolvedViewerMode: 'player' | 'guest' | 'mc' = viewerMode ?? (allowGuestFallback ? 'guest' : 'player')
  const isGuest = resolvedViewerMode === 'guest'
  const isMc = resolvedViewerMode === 'mc'
  const disableInteractions = isGuest || isMc

  const isRoundTypeValue = (value: string): value is RoundType =>
    value === 'khoi_dong' || value === 'vcnv' || value === 'tang_toc' || value === 've_dich'

  const resolvedRoundType = useMemo<RoundType | null>(
    () => (isRoundTypeValue(roundType) ? roundType : null),
    [roundType]
  )

  const soundRegistryRef = useRef<SoundRegistry | null>(null)
  const soundCacheRef = useRef<SoundCacheManager | null>(null)
  const soundControllerRef = useRef<SoundController | null>(null)
  const soundRouterRef = useRef<SoundEventRouter | null>(null)
  const soundPreloadedRef = useRef(false)
  const soundDebounceRef = useRef<{ key: GameEvent; ts: number } | null>(null)
  const prevRoundTypeRef = useRef<RoundType | null>(null)
  const prevQuestionStateRef = useRef<string | null>(null)
  const prevTimerDeadlineRef = useRef<string | null>(null)
  const prevTimerExpiredRef = useRef(false)
  const prevAnswerIdRef = useRef<string | null>(null)
  const prevStarUseIdRef = useRef<string | null>(null)
  const prevQuestionIdRef = useRef<string | null>(null)

  const emitSoundEvent = useCallback(
    async (event: GameEvent, payload?: GameEventPayload) => {
      if (!isGuest) return
      const router = soundRouterRef.current
      if (!router) return
      const now = Date.now()
      const last = soundDebounceRef.current
      if (last && last.key === event && now - last.ts < 300) return
      soundDebounceRef.current = { key: event, ts: now }
      await router.routeEvent(event, payload)
    },
    [isGuest]
  )

  useEffect(() => {
    if (!isGuest) return
    if (!soundRegistryRef.current) {
      const registry = new SoundRegistry()
      const cache = new SoundCacheManager(registry)
      const controller = new SoundController(cache, registry)
      const router = new SoundEventRouter(controller)
      soundRegistryRef.current = registry
      soundCacheRef.current = cache
      soundControllerRef.current = controller
      soundRouterRef.current = router
    }

    if (!soundPreloadedRef.current) {
      soundPreloadedRef.current = true
      void soundCacheRef.current?.preloadAllSounds().then((result) => {
        if (result.failed.length > 0) {
          console.warn('[Olympia][Sound] preload fail', { failed: result.failed })
        }
      })
    }

    return () => {
      soundRouterRef.current?.cleanup()
      soundControllerRef.current?.stopAll()
      soundCacheRef.current?.clear()
    }
  }, [isGuest])

  const resolvedMcScoreboardSlotId = mcScoreboardSlotId ?? 'olympia-mc-scoreboard-slot'
  const [mcScoreboardSlotEl, setMcScoreboardSlotEl] = useState<HTMLElement | null>(null)
  const resolvedMcBuzzerSlotId = mcBuzzerSlotId ?? 'olympia-mc-buzzer-slot'
  const [mcBuzzerSlotEl, setMcBuzzerSlotEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!isMc) {
      setMcScoreboardSlotEl(null)
      setMcBuzzerSlotEl(null)
      return
    }
    if (typeof document === 'undefined') return
    setMcScoreboardSlotEl(document.getElementById(resolvedMcScoreboardSlotId))
    setMcBuzzerSlotEl(document.getElementById(resolvedMcBuzzerSlotId))
  }, [isMc, resolvedMcBuzzerSlotId, resolvedMcScoreboardSlotId])

  const guestAudioRef = useRef<HTMLAudioElement | null>(null)
  const syncedVideoRef = useRef<HTMLVideoElement | null>(null)
  const lastMediaCmdRef = useRef<{ audio: number; video: number }>({ audio: 0, video: 0 })

  const showBigScoreboard = session.show_scoreboard_overlay === true
  const showAnswersOverlay = session.show_answers_overlay === true
  const lastFastestBuzzerRef = useRef<{ roundQuestionId: string | null; key: string | null }>({
    roundQuestionId: null,
    key: null,
  })

  const formatPlayerLabel = useCallback((playerId: string | null | undefined) => {
    if (!playerId) return '—'
    const p = players.find((row) => row.id === playerId)
    if (!p) return playerId
    const name = p.display_name ?? 'Thí sinh'
    return `${name}`
  }, [players])

  const currentQuestionId = session.current_round_question_id
  const currentQuestionResetTs = useMemo((): number | null => {
    if (!currentQuestionId) return null
    const all = (buzzerEvents as unknown as BuzzerEventLite[]).filter(
      (e) => (e.round_question_id ?? null) === currentQuestionId
    )
    if (all.length === 0) return null
    const resetTs = all
      .filter((e) => (e.event_type ?? null) === 'reset' && e.occurred_at)
      .map((e) => Date.parse(e.occurred_at ?? ''))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0]
    return Number.isFinite(resetTs) ? (resetTs as number) : null
  }, [buzzerEvents, currentQuestionId])

  const currentQuestionBuzzerEvents = useMemo((): BuzzerEventLite[] => {
    if (!currentQuestionId) return []

    const all = (buzzerEvents as unknown as BuzzerEventLite[]).filter(
      (e) => (e.round_question_id ?? null) === currentQuestionId
    )
    if (all.length === 0) return []

    const resetTs = all
      .filter((e) => (e.event_type ?? null) === 'reset' && e.occurred_at)
      .map((e) => Date.parse(e.occurred_at ?? ''))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0]

    const effective = Number.isFinite(resetTs)
      ? all.filter((e) => {
        const ts = e.occurred_at ? Date.parse(e.occurred_at) : NaN
        return Number.isFinite(ts) && ts >= (resetTs as number)
      })
      : all

    return effective.filter((e) => (e.event_type ?? null) !== 'reset')
  }, [buzzerEvents, currentQuestionId])
  const currentRoundQuestion = currentQuestionId ? roundQuestions.find((q) => q.id === currentQuestionId) ?? null : null
  const questionRecord = currentRoundQuestion?.questions
    ? (Array.isArray(currentRoundQuestion.questions)
      ? currentRoundQuestion.questions[0] ?? null
      : currentRoundQuestion.questions)
    : null
  const questionSetItemRecord = currentRoundQuestion?.question_set_items
    ? (Array.isArray(currentRoundQuestion.question_set_items)
      ? currentRoundQuestion.question_set_items[0] ?? null
      : currentRoundQuestion.question_set_items)
    : null
  const questionText = currentRoundQuestion?.question_text ?? questionRecord?.question_text ?? null
  const answerText = currentRoundQuestion?.answer_text ?? questionRecord?.answer_text ?? null
  const noteText = currentRoundQuestion?.note ?? questionRecord?.note ?? null
  const mediaUrl = (questionSetItemRecord?.image_url ?? questionRecord?.image_url ?? null)?.trim() || null
  const audioUrl = (questionSetItemRecord?.audio_url ?? questionRecord?.audio_url ?? null)?.trim() || null

  const metaQuestionCode = useMemo(() => {
    const meta = currentRoundQuestion?.meta
    if (!meta || typeof meta !== 'object') return null
    const rec = meta as Record<string, unknown>
    const raw = rec.code
    const trimmed = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
    return trimmed || null
  }, [currentRoundQuestion?.meta])

  const questionCode = useMemo(() => {
    const raw = (metaQuestionCode ?? questionSetItemRecord?.code ?? questionRecord?.code ?? null)
    const trimmed = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
    return trimmed || null
  }, [metaQuestionCode, questionRecord?.code, questionSetItemRecord?.code])

  // Chỉ hiển thị UI chướng ngại vật khi câu hiện tại là CNV (không áp dụng cho VCNV-1..4/OTT).
  const isCnvQuestion = useMemo(() => {
    if (!questionCode) return false
    return questionCode.startsWith('CNV') && !questionCode.startsWith('VCNV')
  }, [questionCode])

  const shouldUseVcnvUi = roundType === 'vcnv' && isCnvQuestion && (isMc || questionState !== 'hidden')

  const showQuestionText = Boolean(questionText) && (isMc || questionState !== 'hidden') && !shouldUseVcnvUi
  const showQuestionMedia = Boolean(mediaUrl) && (isMc || questionState !== 'hidden') && !shouldUseVcnvUi
  const targetPlayerId = currentRoundQuestion?.target_player_id ?? null
  const targetPlayer = targetPlayerId ? players.find((p) => p.id === targetPlayerId) ?? null : null
  const viewerPlayer = viewerUserId ? players.find((p) => p.participant_id === viewerUserId) ?? null : null
  const isViewerTarget = Boolean(viewerPlayer?.id && targetPlayerId && viewerPlayer.id === targetPlayerId)
  const isViewerDisqualifiedObstacle = roundType === 'vcnv' && viewerPlayer?.is_disqualified_obstacle === true

  // ve_dich_value/star_uses vẫn được giữ trong state để dùng ở giai đoạn sau;
  // UI game hiện tại chưa hiển thị các badge này.

  const stealWinnerPlayerId =
    isStealWindow && currentQuestionId
      ? (currentQuestionBuzzerEvents
        .find((e) => (e.event_type ?? 'steal') === 'steal' && e.result === 'win')
        ?.player_id ?? null)
      : null
  const isViewerStealWinner = Boolean(viewerPlayer?.id && stealWinnerPlayerId && viewerPlayer.id === stealWinnerPlayerId)
  const stealWinnerLabel = stealWinnerPlayerId ? formatPlayerLabel(stealWinnerPlayerId) : null

  const canSubmitVeDich =
    !disableInteractions &&
    Boolean(
      viewerPlayer?.id &&
      currentQuestionId &&
      ((questionState === 'showing' && isViewerTarget) || (isStealWindow && isViewerStealWinner))
    )

  // Quy tắc chung: ngoài VCNV, nếu đã có target_player_id thì chỉ target mới được gửi.
  // (target có thể là lượt cá nhân hoặc người bấm chuông thắng).
  const isLockedToTarget = roundType !== 'vcnv' && Boolean(targetPlayerId)
  const canSubmitGeneric = !disableInteractions && (!isLockedToTarget || Boolean(isViewerTarget)) && !isViewerDisqualifiedObstacle
  // Disable submit nếu câu hiện tại là CNV (chỉ host/MC xác nhận đáp án, không cho client gửi trực tiếp)
  const disableAnswerSubmit = isCnvQuestion || (isVeDich ? !canSubmitVeDich : !canSubmitGeneric)

  const canBuzzVeDich =
    !disableInteractions &&
    Boolean(
      viewerPlayer?.id &&
      isStealWindow &&
      !isViewerTarget
    )
  const disableBuzz = (session.buzzer_enabled === false) || (isVeDich ? !canBuzzVeDich : disableInteractions) || isViewerDisqualifiedObstacle

  const isSessionRunning = session.status === 'running'
  const isWaitingScreen = !isMc && questionState === 'hidden'
  const isOnline = useOnlineStatus()

  useEffect(() => {
    setOptimisticBuzzerWinner(null)
  }, [currentQuestionId])

  useEffect(() => {
    if (questionState === 'hidden') {
      setOptimisticBuzzerWinner(null)
      return
    }
    if (!currentQuestionId) return
    if (!currentQuestionResetTs) return
    if (!optimisticBuzzerWinner) return
    if (optimisticBuzzerWinner.roundQuestionId !== currentQuestionId) return
    if (optimisticBuzzerWinner.createdAtMs < currentQuestionResetTs) {
      setOptimisticBuzzerWinner(null)
    }
  }, [currentQuestionId, currentQuestionResetTs, optimisticBuzzerWinner, questionState])

  const viewerSeatNameText = useMemo(() => {
    if (resolvedViewerMode !== 'player') return null
    if (!viewerPlayer) return null
    const seat = typeof viewerPlayer.seat_index === 'number' ? viewerPlayer.seat_index : null
    const name = viewerPlayer.display_name ?? 'Thí sinh'
    return seat != null ? `Ghế ${seat} · ${name}` : name
  }, [resolvedViewerMode, viewerPlayer])

  const turnStatusText = useMemo(() => {
    if (resolvedViewerMode !== 'player') return null
    if (isWaitingScreen) return null
    if (!currentQuestionId) return 'Chưa có câu hỏi'

    // Ưu tiên hiển thị trạng thái buzzer (nếu có người thắng) để đúng trường hợp cướp chuông.
    const winnerBuzzId =
      currentQuestionBuzzerEvents
        .find((e) => (e.event_type ?? 'buzz') === (isStealWindow ? 'steal' : 'buzz') && e.result === 'win')
        ?.player_id ?? null

    const optimisticWinnerId =
      optimisticBuzzerWinner &&
        optimisticBuzzerWinner.roundQuestionId === currentQuestionId &&
        optimisticBuzzerWinner.eventType === (isStealWindow ? 'steal' : 'buzz')
        ? optimisticBuzzerWinner.playerId
        : null

    const effectiveWinnerId = winnerBuzzId ?? optimisticWinnerId

    if (effectiveWinnerId) {
      return roundType === 'vcnv'
        ? `${formatPlayerLabel(effectiveWinnerId)}`
        : `${formatPlayerLabel(effectiveWinnerId)}`
    }
    if (session.buzzer_enabled !== false && (questionState === 'showing' || isStealWindow)) {
      return 'Chưa ai bấm chuông'
    }
    // Tránh duplicate hiển thị lượt: lượt đã được gắn ở header (cạnh tên vòng).
    if (targetPlayerId) return null
    return '—'
  }, [currentQuestionBuzzerEvents, currentQuestionId, formatPlayerLabel, isStealWindow, isWaitingScreen, optimisticBuzzerWinner, questionState, resolvedViewerMode, roundType, session.buzzer_enabled, targetPlayerId])

  void answers
  void starUses
  void isKhoiDong
  void targetPlayer
  void stealWinnerLabel
  void vcnvRevealByRoundQuestionId

  const viewerTotalScore = viewerPlayer?.id ? (scoreboard.find((s) => s.id === viewerPlayer.id)?.total ?? 0) : null
  void showQuestionText
  const playerTurnSuffix =
    resolvedViewerMode === 'player' && !isWaitingScreen && targetPlayerId
      ? ` · Luợt: ${formatPlayerLabel(targetPlayerId)}`
      : ''

  const playerBuzzerLabel = useMemo(() => {
    if (resolvedViewerMode !== 'player') return null
    if (isWaitingScreen) return '—'
    if (!currentQuestionId) return '—'

    const winnerBuzzId =
      currentQuestionBuzzerEvents
        .find((e) => (e.event_type ?? 'buzz') === (isStealWindow ? 'steal' : 'buzz') && e.result === 'win')
        ?.player_id ?? null

    const optimisticWinnerId =
      optimisticBuzzerWinner &&
        optimisticBuzzerWinner.roundQuestionId === currentQuestionId &&
        optimisticBuzzerWinner.eventType === (isStealWindow ? 'steal' : 'buzz')
        ? optimisticBuzzerWinner.playerId
        : null

    const effectiveWinnerId = winnerBuzzId ?? optimisticWinnerId

    if (effectiveWinnerId) return `${formatPlayerLabel(effectiveWinnerId)}`
    if (session.buzzer_enabled === false) return 'Đang tắt'
    if (questionState === 'showing' || isStealWindow) return 'Chưa ai bấm chuông'
    return '—'
  }, [currentQuestionBuzzerEvents, currentQuestionId, formatPlayerLabel, isStealWindow, isWaitingScreen, optimisticBuzzerWinner, questionState, resolvedViewerMode, session.buzzer_enabled])

  const mcTurnLabel = useMemo(() => {
    if (!isMc) return null
    if (!currentQuestionId) return 'Chưa có câu hỏi'
    return targetPlayerId ? formatPlayerLabel(targetPlayerId) : '—'
  }, [currentQuestionId, formatPlayerLabel, isMc, targetPlayerId])

  const mcBuzzerLabel = useMemo(() => {
    if (!isMc) return null
    if (!currentQuestionId) return '—'

    const winnerBuzzId =
      currentQuestionBuzzerEvents
        .find((e) => (e.event_type ?? 'buzz') === (isStealWindow ? 'steal' : 'buzz') && e.result === 'win')
        ?.player_id ?? null

    if (winnerBuzzId) return `${formatPlayerLabel(winnerBuzzId)}`
    if (session.buzzer_enabled === false) return 'Đang tắt'
    if (questionState === 'showing' || isStealWindow) return 'Chưa ai bấm chuông'
    return '—'
  }, [currentQuestionBuzzerEvents, currentQuestionId, formatPlayerLabel, isMc, isStealWindow, questionState, session.buzzer_enabled])

  // Optimistic UI: thí sinh bấm chuông thắng -> status đổi ngay, không chờ realtime/poll.
  useEffect(() => {
    const msg = (buzzerState.success ?? '').trim()
    if (!msg) return
    if (resolvedViewerMode !== 'player') return
    if (!viewerPlayer?.id) return
    if (!currentQuestionId) return

    const lower = msg.toLowerCase()
    const isLose = lower.includes('không phải người nhanh nhất')
    const isWin = lower.includes('giành quyền') || lower.includes('bấm nhanh nhất') || lower.includes('xin đoán cnv')
    if (!isWin || isLose) return

    setOptimisticBuzzerWinner({
      roundQuestionId: currentQuestionId,
      playerId: viewerPlayer.id,
      eventType: isStealWindow ? 'steal' : 'buzz',
      createdAtMs: Date.now(),
    })
  }, [buzzerState.success, currentQuestionId, isStealWindow, resolvedViewerMode, viewerPlayer?.id])

  useEffect(() => {
    // Đổi câu thì reset optimistic winner.
    setOptimisticBuzzerWinner((prev) => {
      if (!prev) return null
      if (prev.roundQuestionId !== currentQuestionId) return null
      return prev
    })
  }, [currentQuestionId])

  useEffect(() => {
    // Nếu server đã reset (buzzer events rỗng sau reset) thì bỏ optimistic.
    if (!currentQuestionId) return
    if (!optimisticBuzzerWinner) return
    if (optimisticBuzzerWinner.roundQuestionId !== currentQuestionId) return
    if (currentQuestionBuzzerEvents.length === 0) {
      setOptimisticBuzzerWinner(null)
    }
  }, [currentQuestionBuzzerEvents.length, currentQuestionId, optimisticBuzzerWinner])

  const mediaKind = useMemo(() => {
    if (!mediaUrl) return null
    const lower = mediaUrl.toLowerCase()
    const isYouTube = lower.includes('youtube.com') || lower.includes('youtu.be')
    if (isYouTube) return 'youtube'
    const isVideo = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(lower)
    if (isVideo) return 'video'
    const isImage = /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/.test(lower)
    if (isImage) return 'image'
    // Fallback: cột này có thể là link Ảnh/Video nhưng không có extension
    return 'link'
  }, [mediaUrl])

  useEffect(() => {
    if (!isGuest || !resolvedRoundType) {
      prevRoundTypeRef.current = null
      return
    }

    const prev = prevRoundTypeRef.current
    if (prev && prev !== resolvedRoundType) {
      void emitSoundEvent(GameEvent.ROUND_ENDED, { roundType: prev })
    }
    if (prev !== resolvedRoundType) {
      void emitSoundEvent(GameEvent.ROUND_STARTED, { roundType: resolvedRoundType })
    }
    prevRoundTypeRef.current = resolvedRoundType
  }, [emitSoundEvent, isGuest, resolvedRoundType])

  useEffect(() => {
    if (!isGuest) return
    const prev = prevQuestionStateRef.current

    if (questionState === 'showing' && prev !== 'showing') {
      void emitSoundEvent(GameEvent.QUESTION_REVEALED, {
        roundType: resolvedRoundType ?? undefined,
      })
    }

    if (questionState === 'answer_revealed' && prev !== 'answer_revealed' && resolvedRoundType === 'tang_toc') {
      void emitSoundEvent(GameEvent.REVEAL_ANSWER, { roundType: resolvedRoundType })
    }

    prevQuestionStateRef.current = questionState
  }, [emitSoundEvent, isGuest, questionState, resolvedRoundType])

  useEffect(() => {
    if (!isGuest || !resolvedRoundType) {
      prevTimerDeadlineRef.current = session.timer_deadline ?? null
      return
    }

    const prev = prevTimerDeadlineRef.current
    const next = session.timer_deadline ?? null

    if (!prev && next) {
      const hasVideo = mediaKind === 'video' || mediaKind === 'youtube'
      void emitSoundEvent(GameEvent.TIMER_STARTED, { roundType: resolvedRoundType, hasVideo })
    }

    if (prev && !next) {
      void emitSoundEvent(GameEvent.TIMER_ENDED, { roundType: resolvedRoundType })
    }

    prevTimerDeadlineRef.current = next
  }, [emitSoundEvent, isGuest, mediaKind, resolvedRoundType, session.timer_deadline])

  useEffect(() => {
    if (!isGuest || !resolvedRoundType) return
    if (!prevTimerExpiredRef.current && timer.isExpired) {
      void emitSoundEvent(GameEvent.TIMER_ENDED, { roundType: resolvedRoundType })
    }
    prevTimerExpiredRef.current = timer.isExpired
  }, [emitSoundEvent, isGuest, resolvedRoundType, timer.isExpired])

  useEffect(() => {
    if (!isGuest || !resolvedRoundType) return
    const latest = answers[0]
    if (!latest?.id) return
    if (prevAnswerIdRef.current === latest.id) return
    prevAnswerIdRef.current = latest.id

    // [GIẢ ĐỊNH]: answers[0] phản ánh kết quả chấm mới nhất cho câu hiện tại.
    if (typeof latest.is_correct === 'boolean') {
      void emitSoundEvent(
        latest.is_correct ? GameEvent.CORRECT_ANSWER : GameEvent.WRONG_ANSWER,
        { roundType: resolvedRoundType }
      )
    }
  }, [answers, emitSoundEvent, isGuest, resolvedRoundType])

  useEffect(() => {
    if (!isGuest || resolvedRoundType !== 've_dich') return
    const latest = starUses[0]
    if (!latest?.id) return
    if (prevStarUseIdRef.current === latest.id) return
    prevStarUseIdRef.current = latest.id
    void emitSoundEvent(GameEvent.STAR_REVEALED, { roundType: resolvedRoundType })
  }, [emitSoundEvent, isGuest, resolvedRoundType, starUses])

  useEffect(() => {
    if (!isGuest || resolvedRoundType !== 'vcnv') return
    const nextId = currentQuestionId ?? null
    const prevId = prevQuestionIdRef.current
    if (nextId && nextId !== prevId) {
      void emitSoundEvent(GameEvent.SELECT_ROW, { roundType: resolvedRoundType })
    }
    prevQuestionIdRef.current = nextId
  }, [currentQuestionId, emitSoundEvent, isGuest, resolvedRoundType])

  const youtubeEmbedUrl = useMemo(() => {
    if (!mediaUrl || mediaKind !== 'youtube') return null
    try {
      const url = new URL(mediaUrl)
      if (url.hostname.includes('youtu.be')) {
        const id = url.pathname.replace('/', '').trim()
        return id ? `https://www.youtube.com/embed/${id}` : null
      }
      const v = url.searchParams.get('v')
      return v ? `https://www.youtube.com/embed/${v}` : null
    } catch {
      return null
    }
  }, [mediaKind, mediaUrl])

  useEffect(() => {
    const canReceiveVideoControl = isGuest || resolvedViewerMode === 'player'
    const canReceiveAudioControl = isGuest
    if (!canReceiveVideoControl && !canReceiveAudioControl) return
    const control = session.guest_media_control
    if (!control) return

    const applyCommand = async (mediaType: 'audio' | 'video') => {
      if (mediaType === 'audio' && !canReceiveAudioControl) return
      if (mediaType === 'video' && !canReceiveVideoControl) return

      const cmd = control[mediaType]
      if (!cmd) return
      const cmdId = typeof cmd.commandId === 'number' ? cmd.commandId : 0
      if (cmdId <= lastMediaCmdRef.current[mediaType]) return
      const action = cmd.action
      const element = mediaType === 'audio' ? guestAudioRef.current : syncedVideoRef.current

      // Nếu media element chưa mount xong, để effect chạy lại khi UI render xong.
      if (!element) {
        console.info('[Olympia][GuestMedia] element not mounted yet', {
          mediaType,
          action,
          cmdId,
          isWaitingScreen,
          resolvedViewerMode,
        })
        return
      }

      console.info('[Olympia][GuestMedia] received command', {
        mediaType,
        action,
        cmdId,
        readyState: element.readyState,
        paused: element.paused,
        currentTime: Number.isFinite(element.currentTime) ? element.currentTime : null,
        muted: element.muted,
        isWaitingScreen,
        resolvedViewerMode,
      })

      lastMediaCmdRef.current = { ...lastMediaCmdRef.current, [mediaType]: cmdId }

      const waitForCanPlay = async (el: HTMLMediaElement) => {
        if (el.readyState >= 2) return

        await new Promise<void>((resolve) => {
          let done = false
          const finish = () => {
            if (done) return
            done = true
            el.removeEventListener('canplay', finish)
            el.removeEventListener('loadeddata', finish)
            resolve()
          }

          el.addEventListener('canplay', finish)
          el.addEventListener('loadeddata', finish)
          window.setTimeout(finish, 1200)
        })
      }

      const tryPlay = async (el: HTMLMediaElement, opts?: { restart?: boolean }) => {
        try {
          // Một số trình duyệt cần load trước khi play (đặc biệt khi src mới set).
          if (el.readyState === 0) {
            try {
              el.load()
            } catch {
              // ignore
            }
          }

          await waitForCanPlay(el)

          if (opts?.restart) {
            try {
              el.currentTime = 0
            } catch {
              // ignore
            }
          }

          const p = el.play()
          if (p && typeof (p as Promise<void>).then === 'function') {
            await p
          }
        } catch {
          // Autoplay có thể bị chặn. Thử phát ở chế độ muted (thường được phép autoplay).
          const prevMuted = el.muted
          try {
            el.muted = true
            const p2 = el.play()
            if (p2 && typeof (p2 as Promise<void>).then === 'function') {
              await p2
            }
          } catch (err) {
            console.info('[Olympia][GuestMedia] play blocked', {
              mediaType,
              action: cmd.action,
              readyState: el.readyState,
              error: err instanceof Error ? err.message : String(err),
            })
          } finally {
            // Khôi phục trạng thái muted (nếu autoplay chỉ chạy được khi muted, user có thể tự bật âm thủ công).
            el.muted = prevMuted
          }
        }
      }

      try {
        if (action === 'pause') {
          element.pause()
          console.info('[Olympia][GuestMedia] applied pause', {
            mediaType,
            cmdId,
            paused: element.paused,
            currentTime: Number.isFinite(element.currentTime) ? element.currentTime : null,
          })
          return
        }

        // play/restart
        await tryPlay(element, { restart: action === 'restart' })
        console.info('[Olympia][GuestMedia] applied play', {
          mediaType,
          cmdId,
          paused: element.paused,
          currentTime: Number.isFinite(element.currentTime) ? element.currentTime : null,
          readyState: element.readyState,
          muted: element.muted,
        })
      } catch {
        // Trình duyệt có thể chặn autoplay; bỏ qua để tránh spam toast.
      }
    }

    void applyCommand('audio')
    void applyCommand('video')
  }, [audioUrl, isGuest, isWaitingScreen, mediaUrl, resolvedViewerMode, session.guest_media_control])

  // Toast notification for session state
  useEffect(() => {
    if (!isSessionRunning) {
      toast.info('Phòng chưa mở')
    }
  }, [isSessionRunning])

  // Guest: toast tên người bấm chuông nhanh nhất (mỗi câu hỏi 1 lần)
  useEffect(() => {
    if (!isGuest) return
    if (session.buzzer_enabled === false) return
    if (!currentQuestionId) return

    const relevantEvents = currentQuestionBuzzerEvents
      .filter((e) => Boolean(e.player_id))

    if (relevantEvents.length === 0) return

    const getTimeMs = (e: (typeof relevantEvents)[number]) => {
      const ts = e.occurred_at
      const parsed = ts ? Date.parse(ts) : NaN
      return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
    }

    const fastest = [...relevantEvents].sort((a, b) => getTimeMs(a) - getTimeMs(b))[0]
    if (!fastest) return

    const fastestKey = fastest.id ?? `${fastest.player_id ?? 'unknown'}|${fastest.occurred_at ?? ''}`
    const alreadyToasted =
      lastFastestBuzzerRef.current.roundQuestionId === currentQuestionId &&
      lastFastestBuzzerRef.current.key === fastestKey
    if (alreadyToasted) return

    lastFastestBuzzerRef.current = { roundQuestionId: currentQuestionId, key: fastestKey }

    const player = fastest.player_id ? players.find((p) => p.id === fastest.player_id) ?? null : null
    const name = player?.display_name ?? (player?.seat_index != null ? `Ghế ${player.seat_index}` : 'Một thí sinh')
    toast.success(`${name} bấm nhanh nhất`)
  }, [currentQuestionBuzzerEvents, currentQuestionId, isGuest, players, session.buzzer_enabled])

  return (
    <>
      <OlympiaQuestionsPreloadOverlay
        roundQuestions={preloadRoundQuestions}
        storageKey={`olympia:preload:client:${session.id}`}
      />
      <div
        className="min-h-screen bg-black text-white flex flex-col relative"
        style={{
          backgroundImage: isWaitingScreen
            ? `url('/olympia-theme/pointscreen_default_O22_new.png')`
            : `url('/olympia-theme/default_background.png')`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#000',
        }}
      >
        {/* Popup mất mạng: KHÔNG hiện trên guest */}
        {!isGuest && !isOnline ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-[min(520px,calc(100%-2rem))] rounded-lg border bg-background p-6 text-foreground">
              <p className="text-sm font-semibold">Không có kết nối Internet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bạn đang offline. Hệ thống sẽ tự đồng bộ lại khi có mạng.
              </p>
            </div>
          </div>
        ) : null}

        {/* HUD (ẩn ở guest) */}
        {!isGuest ? (
          <header className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-950/70 backdrop-blur-sm">
            <div className="min-w-0 flex flex-row gap-1">
              <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 inline-w-fit">
                <p className="text-xs uppercase tracking-widest text-slate-200">
                  {questionTitle}
                  {playerTurnSuffix}
                </p>
                <p className="text-sm text-slate-100 truncate">{match.name}</p>
              </div>
            </div>

            <div className="min-w-0 flex-1 flex justify-center">
              {isMc ? (
                <div className="flex flex-wrap justify-center gap-2 max-w-[720px]">
                  <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 text-center min-w-[220px]">
                    <p className="text-xs uppercase tracking-widest text-slate-200 truncate">Lượt hiện tại</p>
                    <p className="text-sm text-slate-100 truncate">{mcTurnLabel ?? '—'}</p>
                  </div>
                  <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 text-center min-w-[220px]">
                    <p className="text-xs uppercase tracking-widest text-slate-200 truncate">Bấm chuông</p>
                    <p className="text-sm text-slate-100 truncate">{mcBuzzerLabel ?? '—'}</p>
                  </div>
                </div>
              ) : resolvedViewerMode === 'player' ? (
                <div className="flex flex-wrap justify-center gap-2 max-w-[720px]">
                  <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 text-center min-w-[220px]">
                    <p className="text-xs uppercase tracking-widest text-slate-200 truncate">Thí sinh</p>
                    <p className="text-sm text-slate-100 truncate">{viewerSeatNameText ?? '—'}</p>
                  </div>
                  <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 text-center min-w-[220px]">
                    <p className="text-xs uppercase tracking-widest text-slate-200 truncate">Bấm chuông</p>
                    <p className="text-sm text-slate-100 truncate">{playerBuzzerLabel ?? '—'}</p>
                  </div>
                </div>
              ) : turnStatusText ? (
                <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 text-center max-w-[520px]">
                  <p className="text-xs uppercase tracking-widest text-slate-200 truncate">Realtime</p>
                  <p className="text-sm text-slate-100 truncate">{turnStatusText ?? '—'}</p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'rounded-md px-3 py-1 font-mono text-base whitespace-nowrap border',
                  session.timer_deadline
                    ? 'border-emerald-500/60 text-emerald-100 bg-emerald-950/50'
                    : 'border-slate-500/60 text-slate-100 bg-slate-900/50'
                )}
              >
                {timerLabel}
              </div>

              {viewerTotalScore != null ? (
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-widest text-slate-200">Điểm</p>
                  <p className="text-2xl font-semibold leading-none">{viewerTotalScore}</p>
                </div>
              ) : (
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-widest text-slate-200">Realtime</p>
                  <p className="text-sm font-medium">{isRealtimeReady ? 'ON' : '...'} </p>
                </div>
              )}
            </div>
          </header>
        ) : null}

        {/* Overlay bảng điểm lớn (đồng bộ theo host) */}
        {showBigScoreboard ? (
          <div className={cn(isMc ? 'absolute inset-0 z-[60]' : 'fixed inset-0 z-[60]')}>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url('/olympia-theme/Result.png')`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundColor: '#000',
              }}
            />
            <div className="relative z-10 h-full w-full flex items-center justify-center px-4">
              <div className="w-full max-w-4xl rounded-md border border-slate-700 bg-slate-950/70 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-200">Bảng điểm</p>
                    <p className="text-sm text-slate-100 truncate">{match.name}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  {scoreboard.length > 0 ? (
                    scoreboard.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-4 rounded-md border border-slate-700 bg-slate-950/50 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <p className="text-lg sm:text-xl font-semibold text-slate-50 truncate">
                            {p.name}
                          </p>
                          <p className="text-sm text-slate-200">Ghế {p.seat ?? '—'}</p>
                        </div>
                        <p className="text-3xl sm:text-4xl font-mono font-semibold text-white">{p.total}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-200">Chưa có dữ liệu điểm.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Overlay đáp án (đồng bộ theo host) */}
        {showAnswersOverlay ? (
          <AnswersOverlay
            session={session}
            match={match}
            players={players}
            scores={scores && scores.length > 0 ? scores.map(s => ({ id: s.id ?? `score:${s.player_id}`, player_id: s.player_id, points: s.points ?? null })) : null}
            embedded={isMc}
          />
        ) : null}

        {/* MAIN SCREEN */}
        <main
          className="flex-1 relative flex items-center justify-center px-6 pt-10 pb-44"

        >
          {!isSessionRunning ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
              <div className="text-center space-y-2">
                <p className="text-xs uppercase tracking-widest text-slate-200">Trạng thái</p>
                <p className="text-2xl font-semibold">Phòng chưa mở</p>
                <p className="text-sm text-slate-200">Hiện tại: {questionStateText}</p>
              </div>
            </div>
          ) : null}

          {isWaitingScreen ? (
            <div className=""></div>
          ) : (
            <div className={cn('w-full text-center', isMc ? 'max-w-6xl' : 'max-w-5xl')}>
              {shouldUseVcnvUi ? (
                (() => {
                  const resolveRoundQuestionCode = (rq: (typeof roundQuestions)[number] | null) => {
                    if (!rq) return null
                    const meta = rq.meta
                    if (meta && typeof meta === 'object') {
                      const rec = meta as Record<string, unknown>
                      const raw = rec.code
                      const trimmed = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
                      if (trimmed) return trimmed
                    }

                    const qs = rq.question_set_items
                    const q = rq.questions
                    const qsiCode = Array.isArray(qs) ? (qs[0]?.code ?? null) : (qs?.code ?? null)
                    const qCode = Array.isArray(q) ? (q[0]?.code ?? null) : (q?.code ?? null)
                    const raw = qsiCode ?? qCode ?? null
                    const trimmed = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
                    return trimmed || null
                  }

                  const resolveRoundQuestionAnswerText = (rq: (typeof roundQuestions)[number] | null) => {
                    if (!rq) return null
                    const qs = rq.question_set_items
                    const q = rq.questions
                    const qsiAns = Array.isArray(qs) ? (qs[0]?.answer_text ?? null) : (qs?.answer_text ?? null)
                    const qAns = Array.isArray(q) ? (q[0]?.answer_text ?? null) : (q?.answer_text ?? null)
                    const raw = rq.answer_text ?? qsiAns ?? qAns ?? null
                    const trimmed = typeof raw === 'string' ? raw.trim() : ''
                    return trimmed || null
                  }

                  const currentRoundId = session.current_round_id
                  const vcnvRows = (currentRoundId
                    ? roundQuestions.filter((rq) => rq.match_round_id === currentRoundId)
                    : [])
                    .map((rq) => ({ rq, code: resolveRoundQuestionCode(rq) }))

                  const byCode = new Map<string, (typeof roundQuestions)[number]>()
                  for (const item of vcnvRows) {
                    if (!item.code) continue
                    if (!byCode.has(item.code)) byCode.set(item.code, item.rq)
                  }

                  const rowDefs = [
                    { code: 'VCNV-1', label: '1' },
                    { code: 'VCNV-2', label: '2' },
                    { code: 'VCNV-3', label: '3' },
                    { code: 'VCNV-4', label: '4' },
                  ] as const

                  const missingCodes = rowDefs
                    .filter((d) => !byCode.get(d.code))
                    .map((d) => d.code)

                  const cnvLettersCount = (() => {
                    const raw = typeof answerText === 'string' ? answerText : ''
                    const letters = Array.from(raw).filter((ch) => ch.trim() !== '')
                    return letters.length
                  })()

                  const renderRow = (rq: (typeof roundQuestions)[number] | null, idxLabel: string) => {
                    const answer = resolveRoundQuestionAnswerText(rq)
                    const letters = answer ? Array.from(answer).filter((ch) => ch.trim() !== '') : []
                    const opened = Boolean(rq?.id && vcnvRevealByRoundQuestionId[rq.id])
                    const lockedWrong = Boolean(rq?.id && vcnvLockedWrongByRoundQuestionId[rq.id])
                    const slotCount = letters.length

                    const cellSizeClass = 'h-8 w-8 text-sm sm:h-8 sm:w-8 sm:text-base'

                    const isActive = Boolean(rq?.id && rq.id === currentQuestionId && questionState !== 'hidden')
                    const rowBgClass = isActive
                      ? 'bg-sky-950/40 border-sky-400/30'
                      : lockedWrong
                        ? 'bg-destructive/15 border-destructive/30'
                        : opened
                          ? 'bg-slate-950/30 border-slate-700'
                          : 'bg-slate-950/15 border-slate-700'

                    return (
                      <div className={cn('w-full rounded-md border px-3 py-3', rowBgClass)}>
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'flex min-w-0 flex-1 flex-wrap items-start justify-start gap-1.5 sm:gap-2'
                            )}
                          >
                            {Array.from({ length: slotCount }).map((_, i) => {
                              const ch = i < letters.length ? letters[i] ?? null : null
                              const showLetter = opened && ch != null
                              const placeholder = ch != null ? '' : ''

                              return (
                                <div
                                  key={`${idxLabel}-${i}`}
                                  className={cn(
                                    'flex-none shrink-0 rounded-full border flex items-center justify-center font-semibold',
                                    cellSizeClass,
                                    showLetter
                                      ? 'bg-sky-500/25 border-sky-300/60 text-sky-50 shadow-[0_0_18px_rgba(56,189,248,0.25)]'
                                      : lockedWrong
                                        ? 'bg-destructive/70 border-destructive text-destructive-foreground'
                                        : 'bg-slate-950 border-slate-700 text-transparent'
                                  )}
                                >
                                  {showLetter ? ch!.toUpperCase() : placeholder}
                                </div>
                              )
                            })}
                          </div>

                          <div
                            className={cn(
                              'h-9 w-9 sm:h-8 sm:w-8 rounded-full border flex items-center justify-center text-base sm:text-lg font-semibold self-start',
                              isActive
                                ? 'border-sky-300/60 bg-sky-950/40 text-sky-50'
                                : lockedWrong
                                  ? 'border-destructive/60 bg-destructive/15 text-destructive-foreground'
                                  : 'border-slate-700 bg-slate-950/50 text-slate-100'
                            )}
                          >
                            {idxLabel}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (missingCodes.length > 0) {
                    console.warn('[Olympia][VCNV UI] Missing VCNV rows', {
                      matchId: match.id,
                      sessionId: session.id,
                      currentRoundId,
                      currentQuestionId,
                      missingCodes,
                      availableCodes: Array.from(byCode.keys()),
                    })
                  }

                  type CoverPos = 1 | 2 | 3 | 4 | 5
                  const coverBaseClass =
                    'absolute z-10 border border-slate-700/70 bg-slate-950 flex items-center justify-center text-4xl font-semibold text-slate-200 pointer-events-none'
                  const covers: Array<{ pos: CoverPos; label: string | null; style: CSSProperties }> = [
                    {
                      pos: 1,
                      label: '1',
                      style: {
                        left: '0%',
                        top: '0%',
                        width: '50%',
                        height: '50%',
                        clipPath: 'polygon(0% 0%, 100% 0%, 100% 55%, 55% 55%, 55% 100%, 0% 100%)',
                      },
                    },
                    {
                      pos: 2,
                      label: '2',
                      style: {
                        right: '0%',
                        top: '0%',
                        width: '50%',
                        height: '50%',
                        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 45% 100%, 45% 55%, 0% 55%)',
                      },
                    },
                    {
                      pos: 4,
                      label: '4',
                      style: {
                        left: '0%',
                        bottom: '0%',
                        width: '50%',
                        height: '50%',
                        clipPath: 'polygon(0% 0%, 55% 0%, 55% 45%, 100% 45%, 100% 100%, 0% 100%)',
                      },
                    },
                    {
                      pos: 3,
                      label: '3',
                      style: {
                        right: '0%',
                        bottom: '0%',
                        width: '50%',
                        height: '50%',
                        clipPath: 'polygon(45% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 45%, 45% 45%)',
                      },
                    },
                    {
                      pos: 5,
                      label: null,
                      style: {
                        left: '27.5%',
                        top: '27.5%',
                        width: '45%',
                        height: '45%'
                      },
                    },
                  ]

                  return (
                    <div className="mt-6 grid gap-6 md:grid-cols-2 md:items-start text-left relative">
                      {resolvedViewerMode === 'player' && isViewerDisqualifiedObstacle ? (
                        <div className="absolute inset-0 z-50 flex items-center justify-center">
                          <div className="mx-4 w-full max-w-3xl rounded-md border border-rose-400/60 bg-rose-950/80 px-6 py-4 text-center">
                            <p className="text-base sm:text-lg font-semibold text-rose-50">
                              BẠN ĐÃ MẤT QUYỀN THI VÒNG VƯỢT CHƯỚNG NGẠI VẬT
                            </p>
                          </div>
                        </div>
                      ) : null}
                      <div className="md:col-span-1">
                        <div className="relative overflow-hidden rounded-md border border-slate-700 bg-slate-950/60">
                          {mediaUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mediaUrl}
                              alt="CNV"
                              className="h-[360px] w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-[360px] w-full items-center justify-center text-sm text-slate-300">
                              (Chưa có ảnh CNV)
                            </div>
                          )}

                          {covers.map((c) => {
                            const rq =
                              c.pos === 1
                                ? (byCode.get('VCNV-1') ?? null)
                                : c.pos === 2
                                  ? (byCode.get('VCNV-2') ?? null)
                                  : c.pos === 3
                                    ? (byCode.get('VCNV-3') ?? null)
                                    : c.pos === 4
                                      ? (byCode.get('VCNV-4') ?? null)
                                      : (byCode.get('OTT') ?? byCode.get('VCNV-OTT') ?? null)

                            const opened = Boolean(rq?.id && vcnvRevealByRoundQuestionId[rq.id])
                            const lockedWrong = Boolean(rq?.id && vcnvLockedWrongByRoundQuestionId[rq.id])
                            if (opened) return null

                            return (
                              <div
                                key={c.pos}
                                className={cn(
                                  coverBaseClass,
                                  lockedWrong
                                    ? 'bg-destructive border-destructive/70 text-destructive-foreground'
                                    : null
                                )}
                                style={c.style}
                                aria-hidden="true"
                              >
                                {c.label}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="md:col-span-1 space-y-4">
                        <div className="rounded-md border border-slate-700 bg-slate-950/60 px-4 py-3">
                          <p className="text-xs uppercase tracking-widest text-slate-200">
                            CHƯỚNG NGẠI VẬT CÓ {cnvLettersCount} CHỮ
                          </p>
                        </div>

                        {missingCodes.length > 0 ? (
                          <div className="rounded-md border border-amber-500/40 bg-amber-950/30 px-4 py-3">
                            <p className="text-sm text-amber-100 font-medium">Thiếu dữ liệu VCNV</p>
                            <p className="mt-1 text-xs text-amber-200">
                              Không tìm thấy: {missingCodes.join(', ')}
                            </p>
                          </div>
                        ) : null}

                        <div className="space-y-3">
                          {rowDefs.map((d) => {
                            const rq = byCode.get(d.code) ?? null
                            return <div key={d.code} className="w-full">{renderRow(rq, d.label)}</div>
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })()
              ) : null}

              {showQuestionText ? (
                <p className="text-4xl sm:text-5xl font-semibold leading-snug whitespace-pre-wrap text-slate-50">
                  {questionText?.trim() ? questionText : '—'}
                </p>
              ) : null}

              {showQuestionMedia ? (
                <div className="mt-6 mx-auto max-w-4xl rounded-md border border-slate-700 bg-slate-950/60 p-3 text-left">
                  {mediaUrl ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-300">Ảnh/Video</p>
                      {mediaKind === 'image' ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={mediaUrl}
                          alt="Media câu hỏi"
                          className="w-full max-h-[420px] object-contain rounded"
                        />
                      ) : mediaKind === 'video' ? (
                        <video
                          ref={syncedVideoRef}
                          playsInline
                          src={mediaUrl}
                          className="w-full max-h-[420px] rounded bg-black pointer-events-none"
                          tabIndex={-1}
                        />
                      ) : mediaKind === 'youtube' && youtubeEmbedUrl ? (
                        <div className="aspect-video w-full overflow-hidden rounded bg-black">
                          <iframe
                            src={youtubeEmbedUrl}
                            title="Video câu hỏi"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="h-full w-full"
                          />
                        </div>
                      ) : (
                        <a
                          href={mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-sky-300 hover:underline break-all"
                        >
                          {mediaUrl}
                        </a>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {audioUrl && isGuest ? (
                // Audio chỉ phát trên Guest; ẩn UI nhưng vẫn mount để host điều khiển.
                <audio ref={guestAudioRef} src={audioUrl} preload="auto" className="hidden" aria-hidden="true" />
              ) : null}

              {isMc && (answerText || noteText) ? (
                <div className="mt-6 text-left mx-auto max-w-3xl rounded-md border border-slate-700 bg-slate-950/60 p-4">
                  {answerText ? (
                    <p className="text-sm whitespace-pre-wrap">
                      <span className="text-slate-200">Đáp án:</span> {answerText}
                    </p>
                  ) : null}
                  {noteText ? (
                    <p className="mt-2 text-sm whitespace-pre-wrap">
                      <span className="text-slate-200">Ghi chú:</span> {noteText}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {/* Top scoreboard mini (MC): đã chuyển ra ngoài khung game qua portal */}


        </main>

        {/* INTERACTION BAR (ẩn ở guest) */}
        {!isGuest ? (
          <footer className="fixed bottom-0 left-0 right-0 z-40 px-4 py-4 border-t border-slate-700 bg-slate-950/70 backdrop-blur-sm">
            {disableInteractions ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-200">
                  {isMc
                    ? 'Chế độ MC: chỉ quan sát (không gửi đáp án / bấm chuông).'
                    : 'Chế độ khách: đăng nhập để gửi đáp án / bấm chuông.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-1 md:items-center">
                {/* Answer section - center, only show when NOT waiting screen */}
                {!isWaitingScreen && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex flex-wrap gap-3 justify-center">
                      {roundType !== 'khoi_dong' && !isVeDich ? (
                        <form action={answerAction} className="flex items-center gap-2">
                          <input type="hidden" name="sessionId" value={session.id} />
                          <Input
                            name="answer"
                            placeholder="Nhập đáp án"
                            disabled={disableAnswerSubmit}
                            className="w-[220px] bg-slate-900/70 border-slate-600 text-white placeholder:text-slate-300"
                          />
                          <FormSubmitButton disabled={disableAnswerSubmit}>Gửi</FormSubmitButton>
                        </form>
                      ) : null}

                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Refresh button - footer right */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Button
                size="icon"
                variant="outline"
                className="bg-slate-900/70 border-slate-600 text-white hover:bg-slate-800"
                onClick={refreshFromServer}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </footer>
        ) : null}

        {/* Buzzer FAB - bottom right corner */}
        {!disableInteractions && session.buzzer_enabled !== false && (!isVeDich || isStealWindow) && (
          <div className="fixed bottom-24 right-4 z-50">
            <form action={buzzerAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <Button
                type="submit"
                disabled={disableBuzz}
                size="lg"
                className={cn(
                  'w-36 h-36 rounded-full flex items-center justify-center shadow-lg border-0',
                  'bg-white hover:bg-slate-100',
                  'text-blue-600 hover:text-blue-800',
                  'disabled:bg-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed disabled:opacity-100',
                  'transition-colors duration-200 ease-in-out',
                  "[&_svg]:size-auto"

                )}
                variant="default"
              >
                <Bell className="w-36 h-36 scale-[5] origin-center stroke-current" />
              </Button>

            </form>
          </div>
        )}


      </div>

      {isMc && mcScoreboardSlotEl && scoreboard.length > 0
        ? createPortal(
          <div className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs">
            <p className="text-[11px] uppercase tracking-widest text-slate-200">Bảng điểm</p>
            <div className="mt-1 space-y-1">
              {scoreboard.slice(0, 4).map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <span className="text-slate-100">
                    {idx + 1}. {p.name}
                  </span>
                  <span className="font-mono text-white">{p.total}</span>
                </div>
              ))}
            </div>
          </div>,
          mcScoreboardSlotEl
        )
        : null}

      {isMc && mcBuzzerSlotEl
        ? createPortal(
          <div className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs">
            <p className="text-[11px] uppercase tracking-widest text-slate-200 truncate">Bấm chuông</p>
            <p className="mt-1 text-sm text-slate-100 truncate">{mcBuzzerLabel ?? '—'}</p>
          </div>,
          mcBuzzerSlotEl
        )
        : null}
    </>
  )
}
