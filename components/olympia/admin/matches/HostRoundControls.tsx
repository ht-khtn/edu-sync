'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { useActionState } from 'react'
import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Timer } from 'lucide-react'
import { subscribeHostSessionUpdate } from '@/components/olympia/admin/matches/host-events'
import { getCountdownMs, getDurationInputConstraints } from '@/lib/olympia/olympia-config'

export type ActionState = {
  error?: string | null
  success?: string | null
  data?: Record<string, unknown> | null
}

type HostControlAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>

type FormActionDispatch = (formData: FormData) => void

const initialState: ActionState = { error: null, success: null }

const roundLabelMap: Record<string, string> = {
  khoi_dong: 'Khởi động',
  vcnv: 'Vượt chướng ngại vật',
  tang_toc: 'Tăng tốc',
  ve_dich: 'Về đích',
}

function isWaitingScreenOn(questionState: string | null | undefined) {
  return questionState === 'hidden'
}

type MatchRound = {
  id: string
  round_type: string
  order_index: number
}

type CountdownControlsProps = {
  sessionId?: string | null
  currentRoundType: string | null
  currentRoundQuestionId: string | null
  currentQuestionState: string | null
  timerDeadline: string | null
  timerStartAction: FormActionDispatch
  timerExpireAction: FormActionDispatch
  timerStartPending: boolean
  timerExpirePending: boolean
}

function getAutoTimerDurationSeconds(roundType: string | null): number {
  const constraints = getDurationInputConstraints()
  let newDuration = constraints.defaultSeconds

  if (roundType === 've_dich') {
    newDuration = 20
  } else if (roundType === 'khoi_dong') {
    newDuration = Math.round(getCountdownMs('khoi_dong') / 1000)
  } else if (roundType === 'vcnv') {
    newDuration = Math.round(getCountdownMs('vcnv') / 1000)
  } else if (roundType === 'tang_toc') {
    newDuration = Math.round(getCountdownMs('tang_toc') / 1000)
  }

  return newDuration
}

function CountdownControls({
  sessionId,
  currentRoundType,
  currentRoundQuestionId,
  currentQuestionState,
  timerDeadline,
  timerStartAction,
  timerExpireAction,
  timerStartPending,
  timerExpirePending,
}: CountdownControlsProps) {
  const [timerDurationSeconds, setTimerDurationSeconds] = useState<number>(() =>
    getAutoTimerDurationSeconds(currentRoundType)
  )
  const [hasUserEditedDuration, setHasUserEditedDuration] = useState<boolean>(false)
  const [realtimeTimerDeadline, setRealtimeTimerDeadline] = useState<string | null>(null)
  const [countdownTick, setCountdownTick] = useState<number>(0)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const effectiveTimerDeadline = useMemo(() => {
    return realtimeTimerDeadline ?? timerDeadline ?? null
  }, [realtimeTimerDeadline, timerDeadline])

  const autoTimerDurationSeconds = useMemo(() => {
    return getAutoTimerDurationSeconds(currentRoundType)
  }, [currentRoundType])

  // Subscribe to realtime timer updates
  useEffect(() => {
    return subscribeHostSessionUpdate((payload) => {
      if (payload.timerDeadline !== undefined) {
        setRealtimeTimerDeadline(payload.timerDeadline ?? null)
      }
    })
  }, [])

  // Calculate countdown based on effective timer deadline
  const countdownSeconds = useMemo(() => {
    void countdownTick
    if (!effectiveTimerDeadline) return null

    const now = new Date().getTime()
    const deadline = new Date(effectiveTimerDeadline).getTime()
    const diffMs = deadline - now
    const seconds = Math.max(0, Math.ceil(diffMs / 1000))
    return seconds
  }, [effectiveTimerDeadline, countdownTick])

  const durationSecondsValue = useMemo(() => {
    if (countdownSeconds !== null) return timerDurationSeconds
    return hasUserEditedDuration ? timerDurationSeconds : autoTimerDurationSeconds
  }, [autoTimerDurationSeconds, countdownSeconds, hasUserEditedDuration, timerDurationSeconds])

  // Tick countdown (interval only updates tick; countdown itself is derived)
  useEffect(() => {
    if (!effectiveTimerDeadline) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      return
    }

    // Set interval to update countdownTick
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }

    countdownIntervalRef.current = setInterval(() => {
      const now = new Date().getTime()
      const deadline = new Date(effectiveTimerDeadline).getTime()
      const diffMs = deadline - now
      const remainingSeconds = Math.max(0, Math.ceil(diffMs / 1000))

      setCountdownTick((t) => t + 1)

      if (remainingSeconds <= 0 && countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }, 1000)

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [effectiveTimerDeadline])

  const canStartTimer = Boolean(
    sessionId && currentRoundQuestionId && currentQuestionState === 'showing'
  )

  const canExpireTimer = Boolean(
    sessionId &&
    currentRoundQuestionId &&
    currentQuestionState === 'showing' &&
    Boolean(effectiveTimerDeadline) &&
    (currentRoundType === 'vcnv' || currentRoundType === 'tang_toc')
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">Countdown:</Label>
        <Input
          type="number"
          min={getDurationInputConstraints().minSeconds}
          max={getDurationInputConstraints().maxSeconds}
          value={durationSecondsValue}
          onChange={(e) => {
            const constraints = getDurationInputConstraints()
            const val = Math.max(
              constraints.minSeconds,
              Math.min(constraints.maxSeconds, Number(e.target.value) || constraints.defaultSeconds)
            )
            setHasUserEditedDuration(true)
            setTimerDurationSeconds(val)
          }}
          disabled={countdownSeconds !== null}
          className="h-8 w-20"
          aria-label="Thời gian countdown"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const durationMs = durationSecondsValue * 1000
            formData.set('durationMs', String(durationMs))

            const nextDeadlineIso = new Date(Date.now() + durationMs).toISOString()
            setRealtimeTimerDeadline(nextDeadlineIso)

            timerStartAction(formData)
          }}
        >
          <input type="hidden" name="sessionId" value={sessionId ?? ''} />
          <input type="hidden" name="durationMs" value={String(durationSecondsValue * 1000)} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!canStartTimer || timerStartPending || countdownSeconds !== null}
            title="Bấm giờ (theo luật vòng hiện tại)"
            aria-label="Bấm giờ"
          >
            <Timer className="h-4 w-4 mr-1" />
            {countdownSeconds !== null ? `${countdownSeconds}s` : 'Bấm giờ'}
          </Button>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            setRealtimeTimerDeadline(null)
            timerExpireAction(formData)
          }}
        >
          <input type="hidden" name="sessionId" value={sessionId ?? ''} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!canExpireTimer || timerExpirePending || countdownSeconds === null}
            title="Hết giờ (khóa nhận đáp án ở VCNV/Tăng tốc)"
            aria-label="Hết giờ"
          >
            Hết giờ
          </Button>
        </form>
      </div>
    </div>
  )
}

type Props = {
  matchId: string
  sessionId?: string | null
  rounds: MatchRound[]
  players?: Array<{ id: string; seat_index: number | null; display_name: string | null }>
  currentQuestionState?: string | null
  currentRoundType?: string | null
  timerDeadline?: string | null
  buzzerEnabled?: boolean | null
  showScoreboardOverlay?: boolean | null
  showAnswersOverlay?: boolean | null
  allowTargetSelection?: boolean
  currentRoundQuestionId?: string | null
  currentTargetPlayerId?: string | null
  isKhoiDong?: boolean

  setLiveSessionRoundAction: HostControlAction
  setWaitingScreenAction: HostControlAction
  setScoreboardOverlayAction: HostControlAction
  setAnswersOverlayAction: HostControlAction
  setBuzzerEnabledAction: HostControlAction
  setRoundQuestionTargetPlayerAction: HostControlAction

  startSessionTimerAutoAction: HostControlAction
  expireSessionTimerAction: HostControlAction
}

export function HostRoundControls({
  matchId,
  sessionId,
  rounds,
  players,
  currentQuestionState,
  currentRoundType,
  timerDeadline,
  buzzerEnabled,
  showScoreboardOverlay,
  showAnswersOverlay,
  allowTargetSelection,
  currentRoundQuestionId,
  currentTargetPlayerId,
  isKhoiDong,
  setLiveSessionRoundAction,
  setWaitingScreenAction,
  setScoreboardOverlayAction,
  setAnswersOverlayAction,
  setBuzzerEnabledAction,
  setRoundQuestionTargetPlayerAction,
  startSessionTimerAutoAction,
  expireSessionTimerAction,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const baseParams = useMemo(() => new URLSearchParams(searchParams?.toString()), [searchParams])
  const [, startTargetTransition] = useTransition()
  const [, startRoundTransition] = useTransition()
  const [, startBuzzerTransition] = useTransition()

  const [effectiveCurrentRoundQuestionId, setEffectiveCurrentRoundQuestionId] = useState<string | null>(() => currentRoundQuestionId ?? null)
  const [effectiveCurrentQuestionState, setEffectiveCurrentQuestionState] = useState<string | null>(() => currentQuestionState ?? null)
  const [effectiveTimerDeadline, setEffectiveTimerDeadline] = useState<string | null>(() => timerDeadline ?? null)
  const [effectiveBuzzerEnabled, setEffectiveBuzzerEnabled] = useState<boolean | null>(() => buzzerEnabled ?? null)
  const [effectiveShowScoreboardOverlay, setEffectiveShowScoreboardOverlay] = useState<boolean | null>(() => showScoreboardOverlay ?? null)
  const [effectiveShowAnswersOverlay, setEffectiveShowAnswersOverlay] = useState<boolean | null>(() => showAnswersOverlay ?? null)
  const [effectiveCurrentRoundType, setEffectiveCurrentRoundType] = useState<string | null>(() => currentRoundType ?? null)

  useEffect(() => {
    // Đồng bộ realtime/optimistic updates để giảm phụ thuộc router.refresh().
    return subscribeHostSessionUpdate((payload) => {
      if (payload.currentRoundQuestionId !== undefined) setEffectiveCurrentRoundQuestionId(payload.currentRoundQuestionId)
      if (payload.questionState !== undefined) setEffectiveCurrentQuestionState(payload.questionState)
      if (payload.timerDeadline !== undefined) setEffectiveTimerDeadline(payload.timerDeadline)
      if (payload.buzzerEnabled !== undefined) setEffectiveBuzzerEnabled(payload.buzzerEnabled)
      if (payload.showScoreboardOverlay !== undefined) setEffectiveShowScoreboardOverlay(payload.showScoreboardOverlay)
      if (payload.showAnswersOverlay !== undefined) setEffectiveShowAnswersOverlay(payload.showAnswersOverlay)
      if (payload.currentRoundType !== undefined) setEffectiveCurrentRoundType(payload.currentRoundType)
    })
  }, [])

  const isVeDich = effectiveCurrentRoundType === 've_dich'

  const [roundState, roundAction, roundPending] = useActionState(setLiveSessionRoundAction, initialState)
  const [waitingState, waitingAction, waitingPending] = useActionState(setWaitingScreenAction, initialState)
  const [scoreboardState, scoreboardAction, scoreboardPending] = useActionState(setScoreboardOverlayAction, initialState)
  const [answersState, answersAction, answersPending] = useActionState(setAnswersOverlayAction, initialState)
  const [buzzerState, buzzerAction, buzzerPending] = useActionState(setBuzzerEnabledAction, initialState)
  const [targetState, targetAction, targetPending] = useActionState(setRoundQuestionTargetPlayerAction, initialState)
  const [timerStartState, timerStartAction, timerStartPending] = useActionState(startSessionTimerAutoAction, initialState)
  const [timerExpireState, timerExpireAction, timerExpirePending] = useActionState(expireSessionTimerAction, initialState)
  const lastRoundToastRef = useRef<string | null>(null)
  const lastWaitingToastRef = useRef<string | null>(null)
  const lastScoreboardToastRef = useRef<string | null>(null)
  const lastAnswersToastRef = useRef<string | null>(null)
  const lastBuzzerToastRef = useRef<string | null>(null)
  const lastTargetToastRef = useRef<string | null>(null)
  const lastTimerStartToastRef = useRef<string | null>(null)
  const lastTimerExpireToastRef = useRef<string | null>(null)

  const roundFormRef = useRef<HTMLFormElement | null>(null)
  const buzzerFormRef = useRef<HTMLFormElement | null>(null)
  const targetFormRef = useRef<HTMLFormElement | null>(null)

  const roundById = useMemo(() => {
    const map = new Map<string, MatchRound>()
    for (const r of rounds) map.set(r.id, r)
    return map
  }, [rounds])

  const currentRound = rounds.find((r) => r.round_type === effectiveCurrentRoundType) ?? null
  const [roundId, setRoundId] = useState<string>(() => currentRound?.id ?? '')
  const selectedRoundType = roundId ? roundById.get(roundId)?.round_type ?? '' : ''
  const isVeDichLike = isVeDich || selectedRoundType === 've_dich'

  const lastSubmittedRoundIdRef = useRef<string | null>(null)
  const lastSubmittedRoundTypeRef = useRef<string | null>(null)
  const lastSubmittedTargetPlayerIdRef = useRef<string | null>(null)
  const lastAppliedUrlRef = useRef<string | null>(null)

  const [targetPlayerId, setTargetPlayerId] = useState<string>('')
  const [hasUserPickedTarget, setHasUserPickedTarget] = useState<boolean>(false)

  const khoiDongTargetPlayerIdFromUrl = useMemo<string | null>(() => {
    if (!isKhoiDong) return null
    const raw = searchParams?.get('kdSeat') ?? null
    if (!raw) return null
    const seat = Number.parseInt(raw, 10)
    if (!Number.isFinite(seat)) return null
    const selected = players?.find((p) => p.seat_index === seat) ?? null
    return selected?.id ?? null
  }, [isKhoiDong, players, searchParams])
  const veDichTargetPlayerIdFromUrl = useMemo<string | null>(() => {
    if (!isVeDich) return null
    const raw = searchParams?.get('vdSeat') ?? null
    if (!raw) return null
    const seat = Number.parseInt(raw, 10)
    if (!Number.isFinite(seat)) return null
    const selected = players?.find((p) => p.seat_index === seat) ?? null
    return selected?.id ?? null
  }, [isVeDich, players, searchParams])

  const serverTargetPlayerId = currentTargetPlayerId ?? ''
  const resolvedTargetPlayerId = hasUserPickedTarget
    ? targetPlayerId
    : (khoiDongTargetPlayerIdFromUrl ?? veDichTargetPlayerIdFromUrl ?? serverTargetPlayerId)

  type HostViewMode = 'question' | 'waiting' | 'scoreboard' | 'answers'
  const serverViewMode: HostViewMode = effectiveShowAnswersOverlay
    ? 'answers'
    : effectiveShowScoreboardOverlay
      ? 'scoreboard'
      : isWaitingScreenOn(effectiveCurrentQuestionState)
        ? 'waiting'
        : 'question'

  const [viewModeOverride, setViewModeOverride] = useState<HostViewMode | null>(null)
  const viewMode: HostViewMode = viewModeOverride ?? serverViewMode

  const serverBuzzerChecked = effectiveBuzzerEnabled ?? true
  const [optimisticBuzzerChecked, setOptimisticBuzzerChecked] = useState<boolean>(() => serverBuzzerChecked)
  const buzzerChecked = buzzerPending ? optimisticBuzzerChecked : serverBuzzerChecked

  const submitToggleAction = (dispatch: FormActionDispatch, enabled: boolean) => {
    const fd = new FormData()
    fd.set('matchId', matchId)
    fd.set('enabled', enabled ? '1' : '0')
    dispatch(fd)
  }

  const replaceQueryParams = useCallback((params: URLSearchParams) => {
    const qs = params.toString()
    const nextUrl = qs ? `${pathname}?${qs}` : pathname
    if (lastAppliedUrlRef.current === nextUrl) return
    lastAppliedUrlRef.current = nextUrl
    router.replace(nextUrl)
  }, [pathname, router])

  const roundMessage = roundState.error ?? roundState.success
  const waitingMessage = waitingState.error ?? waitingState.success
  const scoreboardMessage = scoreboardState.error ?? scoreboardState.success
  const answersMessage = answersState.error ?? answersState.success
  const buzzerMessage = buzzerState.error ?? buzzerState.success

  const canPickTarget = Boolean(
    allowTargetSelection && (isVeDichLike || effectiveCurrentRoundQuestionId || isKhoiDong)
  )

  // Show toasts for messages
  useEffect(() => {
    const message = roundState.error ?? roundState.success
    if (!message) return
    if (lastRoundToastRef.current === message) return
    lastRoundToastRef.current = message

    if (roundState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [roundState.error, roundState.success, router])

  useEffect(() => {
    const message = waitingState.error ?? waitingState.success
    if (!message) return
    if (lastWaitingToastRef.current === message) return
    lastWaitingToastRef.current = message

    if (waitingState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [waitingState.error, waitingState.success, router])

  useEffect(() => {
    const message = scoreboardState.error ?? scoreboardState.success
    if (!message) return
    if (lastScoreboardToastRef.current === message) return
    lastScoreboardToastRef.current = message

    if (scoreboardState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [scoreboardState.error, scoreboardState.success, router])

  useEffect(() => {
    const message = answersState.error ?? answersState.success
    if (!message) return
    if (lastAnswersToastRef.current === message) return
    lastAnswersToastRef.current = message

    if (answersState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [answersState.error, answersState.success, router])

  useEffect(() => {
    const message = timerStartState.error ?? timerStartState.success
    if (!message) return
    if (lastTimerStartToastRef.current === message) return
    lastTimerStartToastRef.current = message

    if (timerStartState.error) toast.error(message)
    else toast.success(message)
  }, [timerStartState.error, timerStartState.success])

  useEffect(() => {
    const message = timerExpireState.error ?? timerExpireState.success
    if (!message) return
    if (lastTimerExpireToastRef.current === message) return
    lastTimerExpireToastRef.current = message

    if (timerExpireState.error) toast.error(message)
    else toast.success(message)
  }, [timerExpireState.error, timerExpireState.success])

  useEffect(() => {
    const message = buzzerState.error ?? buzzerState.success
    if (!message) return
    if (lastBuzzerToastRef.current === message) return
    lastBuzzerToastRef.current = message

    if (buzzerState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [buzzerState.error, buzzerState.success, router])

  useEffect(() => {
    const message = targetState.error ?? targetState.success
    if (!message) return
    if (lastTargetToastRef.current === message) return
    lastTargetToastRef.current = message

    if (targetState.error) {
      toast.error(message, {
        description: 'Vui lòng kiểm tra lại thông tin và thử lại.',
        duration: 5000,
      })
    } else {
      toast.success(message, {
        duration: 3000,
      })
    }
  }, [targetState.error, targetState.success, router])

  // Chỉ update query params sau khi server action thành công (tránh navigation/refresh trước khi action chạy xong).
  useEffect(() => {
    if (!roundState.success || roundState.error) return
    const submittedRoundType = lastSubmittedRoundTypeRef.current
    const params = new URLSearchParams(baseParams)
    params.delete('preview')
    if (submittedRoundType && submittedRoundType !== 'khoi_dong') {
      params.delete('kdSeat')
    }
    if (submittedRoundType && submittedRoundType !== 've_dich') {
      params.delete('vdSeat')
    }
    const qs = params.toString()
    const nextUrl = qs ? `${pathname}?${qs}` : pathname
    if (lastAppliedUrlRef.current === nextUrl) return
    lastAppliedUrlRef.current = nextUrl
    router.replace(nextUrl)
  }, [roundState, baseParams, pathname, router])

  useEffect(() => {
    if (!targetState.success || targetState.error) return

    const params = new URLSearchParams(baseParams)
    params.delete('preview')

    if (isKhoiDong) {
      const submittedTargetId = lastSubmittedTargetPlayerIdRef.current
      const selectedPlayer = submittedTargetId
        ? players?.find((p) => p.id === submittedTargetId) ?? null
        : null
      const nextSeat = selectedPlayer?.seat_index
      if (nextSeat != null) params.set('kdSeat', String(nextSeat))
      else params.delete('kdSeat')
    }

    if (isVeDich) {
      const submittedTargetId = lastSubmittedTargetPlayerIdRef.current
      const selectedPlayer = submittedTargetId
        ? players?.find((p) => p.id === submittedTargetId) ?? null
        : null
      const nextSeat = selectedPlayer?.seat_index
      if (nextSeat != null) params.set('vdSeat', String(nextSeat))
      else params.delete('vdSeat')
    }

    replaceQueryParams(params)

    // Giữ nguyên selection sau khi xác nhận (không reset về mặc định)
    queueMicrotask(() => {
      const submittedTargetId = lastSubmittedTargetPlayerIdRef.current
      if (submittedTargetId != null) {
        setHasUserPickedTarget(true)
        setTargetPlayerId(submittedTargetId)
      }
    })
  }, [targetState, baseParams, pathname, router, isKhoiDong, isVeDich, players, replaceQueryParams])

  const setViewMode = (next: HostViewMode) => {
    const nextWaiting = next === 'waiting'
    const nextScoreboard = next === 'scoreboard'
    const nextAnswers = next === 'answers'

    setViewModeOverride(next)

    // Dispatch trực tiếp để tránh submit form gây navigation/refresh
    submitToggleAction(waitingAction, nextWaiting)
    submitToggleAction(scoreboardAction, nextScoreboard)
    submitToggleAction(answersAction, nextAnswers)
  }

  return (
    <div className="grid gap-3">
      <CountdownControls
        key={`${effectiveCurrentRoundType ?? 'none'}:${effectiveCurrentRoundQuestionId ?? 'none'}`}
        sessionId={sessionId}
        currentRoundType={effectiveCurrentRoundType}
        currentRoundQuestionId={effectiveCurrentRoundQuestionId}
        currentQuestionState={effectiveCurrentQuestionState}
        timerDeadline={effectiveTimerDeadline}
        timerStartAction={timerStartAction}
        timerExpireAction={timerExpireAction}
        timerStartPending={timerStartPending}
        timerExpirePending={timerExpirePending}
      />

      <form
        ref={roundFormRef}
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          lastSubmittedRoundIdRef.current = roundId
          lastSubmittedRoundTypeRef.current = selectedRoundType
          lastAppliedUrlRef.current = null

          // Reset chọn thí sinh local khi chuyển vòng để tránh “kẹt” selection cũ
          setHasUserPickedTarget(false)
          setTargetPlayerId('')

          // Optimistic: update vòng hiện tại để UI (countdown/defaults) cập nhật ngay
          setEffectiveCurrentRoundType(selectedRoundType || null)

          const formData = new FormData(e.currentTarget)
          startRoundTransition(() => roundAction(formData))
        }}
      >
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="roundType" value={selectedRoundType} />
        <Label className="sr-only">Chuyển vòng</Label>
        <div className="flex items-center gap-2">
          <select
            name="roundId"
            value={roundId}
            onChange={(e) => {
              const nextId = e.target.value
              setRoundId(nextId)
            }}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            required
            aria-label="Chọn vòng"
            disabled={roundPending}
          >
            <option value="" disabled>
              Chọn vòng
            </option>
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                Vòng {round.order_index + 1}: {roundLabelMap[round.round_type] ?? round.round_type}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={!roundId || roundPending} aria-label="Chuyển vòng">
            Chuyển vòng
          </Button>
        </div>
        {roundMessage && !roundState.error ? (
          <p className="text-xs text-green-600">{roundMessage}</p>
        ) : null}
      </form>

      {players && players.length > 0 ? (
        isKhoiDong ? (
          <form
            ref={targetFormRef}
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              lastSubmittedTargetPlayerIdRef.current = resolvedTargetPlayerId
              lastAppliedUrlRef.current = null

              // Optimistic URL update để không cần reload (cả khi server trả message idempotent)
              const params = new URLSearchParams(baseParams)
              params.delete('preview')
              const selected = resolvedTargetPlayerId
                ? players?.find((p) => p.id === resolvedTargetPlayerId) ?? null
                : null
              const nextSeat = selected?.seat_index
              if (nextSeat != null) params.set('kdSeat', String(nextSeat))
              else params.delete('kdSeat')
              replaceQueryParams(params)

              const formData = new FormData(e.currentTarget)
              startTargetTransition(() => targetAction(formData))
            }}
          >
            <input type="hidden" name="matchId" value={matchId} />
            <input type="hidden" name="roundQuestionId" value={currentRoundQuestionId ?? ''} />
            <Label className="sr-only">Chọn ghế (Khởi động)</Label>
            <div className="flex items-center gap-2">
              <select
                name="playerId"
                value={resolvedTargetPlayerId}
                onChange={(e) => {
                  const selectedPlayerId = e.target.value
                  setHasUserPickedTarget(true)
                  setTargetPlayerId(selectedPlayerId)
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                aria-label="Chọn ghế (Khởi động)"
                disabled={targetPending}
              >
                <option value="">Thi chung (DKA)</option>
                {players
                  .filter((p) => typeof p.seat_index === 'number')
                  .slice()
                  .sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      Ghế {p.seat_index ?? '—'} · {p.display_name ?? 'Thí sinh'}
                    </option>
                  ))}
              </select>
              <Button
                type="submit"
                size="sm"
                aria-label="Xác nhận chọn ghế"
                title="Khởi động: chọn ghế để lọc câu, không cần chọn câu trước"
                disabled={targetPending}
              >
                Xác nhận
              </Button>
            </div>
          </form>
        ) : (
          <form
            ref={targetFormRef}
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              lastSubmittedTargetPlayerIdRef.current = resolvedTargetPlayerId
              lastAppliedUrlRef.current = null

              // Optimistic URL update cho Về đích để không cần reload
              if (isVeDichLike) {
                const params = new URLSearchParams(baseParams)
                params.delete('preview')
                const selected = resolvedTargetPlayerId
                  ? players?.find((p) => p.id === resolvedTargetPlayerId) ?? null
                  : null
                const nextSeat = selected?.seat_index
                if (nextSeat != null) params.set('vdSeat', String(nextSeat))
                else params.delete('vdSeat')
                replaceQueryParams(params)
              }

              const formData = new FormData(e.currentTarget)
              startTargetTransition(() => targetAction(formData))
            }}
          >
            <input type="hidden" name="matchId" value={matchId} />
            <input type="hidden" name="roundQuestionId" value={isVeDichLike ? '' : (currentRoundQuestionId ?? '')} />
            {isVeDichLike ? <input type="hidden" name="roundType" value="ve_dich" /> : null}
            <Label className="sr-only">Chọn thí sinh</Label>
            <div className="flex items-center gap-2">
              <select
                name="playerId"
                value={resolvedTargetPlayerId}
                onChange={(e) => {
                  const next = e.target.value
                  setHasUserPickedTarget(true)
                  setTargetPlayerId(next)
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                aria-label="Chọn thí sinh"
                disabled={!allowTargetSelection || targetPending}
              >
                {!resolvedTargetPlayerId ? (
                  <option value="">
                    {!allowTargetSelection
                      ? 'Chọn thí sinh (chỉ dùng cho Về đích)'
                      : isVeDichLike
                        ? 'Về đích: chọn thí sinh trước'
                        : !currentRoundQuestionId
                          ? 'Chọn câu trước để gán thí sinh'
                          : '(Tuỳ vòng) Chọn thí sinh'}
                  </option>
                ) : null}
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    Ghế {p.seat_index ?? '—'} · {p.display_name ?? 'Thí sinh'}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                size="sm"
                aria-label="Xác nhận chọn thí sinh"
                disabled={!canPickTarget || targetPending}
              >
                Xác nhận
              </Button>
            </div>
          </form>
        )
      ) : null}

      <div className="grid gap-2">
        <Label className="text-xs">Giao diện hiện tại</Label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="hostViewMode"
              value="question"
              checked={viewMode === 'question'}
              onChange={() => setViewMode('question')}
              disabled={!effectiveCurrentRoundType || waitingPending || scoreboardPending || answersPending}
              aria-label="Câu hỏi"
            />
            Câu hỏi
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="hostViewMode"
              value="waiting"
              checked={viewMode === 'waiting'}
              onChange={() => setViewMode('waiting')}
              disabled={!effectiveCurrentRoundType || waitingPending || scoreboardPending || answersPending}
              aria-label="Màn chờ"
            />
            Màn chờ
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="hostViewMode"
              value="scoreboard"
              checked={viewMode === 'scoreboard'}
              onChange={() => setViewMode('scoreboard')}
              disabled={!effectiveCurrentRoundType || waitingPending || scoreboardPending || answersPending}
              aria-label="Bảng điểm"
            />
            Bảng điểm
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="hostViewMode"
              value="answers"
              checked={viewMode === 'answers'}
              onChange={() => setViewMode('answers')}
              disabled={!effectiveCurrentRoundType || waitingPending || scoreboardPending || answersPending}
              aria-label="Đáp án"
            />
            Đáp án
          </label>
        </div>
        {waitingMessage && !waitingState.error ? <p className="text-xs text-green-600">{waitingMessage}</p> : null}
        {scoreboardMessage && !scoreboardState.error ? <p className="text-xs text-green-600">{scoreboardMessage}</p> : null}
        {answersMessage && !answersState.error ? <p className="text-xs text-green-600">{answersMessage}</p> : null}
      </div>

      <form
        ref={buzzerFormRef}
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget)
          startBuzzerTransition(() => buzzerAction(formData))
        }}
      >
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="enabled" value={buzzerChecked ? '1' : '0'} />
        <div className="flex items-center justify-between">
          <Label className="text-xs">Bấm chuông</Label>
          <Switch
            checked={buzzerChecked}
            onCheckedChange={(v) => {
              const next = Boolean(v)
              setOptimisticBuzzerChecked(next)
              queueMicrotask(() => {
                submitToggleAction(buzzerAction, next)
              })
            }}
            disabled={!effectiveCurrentRoundType || buzzerPending}
            aria-label="Bấm chuông"
          />
        </div>
        {buzzerMessage && !buzzerState.error ? <p className="text-xs text-green-600">{buzzerMessage}</p> : null}
      </form>
    </div>
  )
}
