'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { useActionState } from 'react'
import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Timer, Play, Pause, Square } from 'lucide-react'
import { subscribeHostSessionUpdate } from '@/components/olympia/admin/matches/host-events'
import { useHostBroadcast } from '@/components/olympia/admin/matches/useHostBroadcast'
import type { QuestionPingPayload, SoundPingPayload, TimerPingPayload } from '@/components/olympia/shared/game/useOlympiaGameState'
import { getCountdownMs, getDurationInputConstraints } from '@/lib/olympia/olympia-config'
import getSupabase from '@/lib/supabase'

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

const baseCountdownOptions = [5, 10, 15, 20, 30] as const
type BaseCountdownOption = (typeof baseCountdownOptions)[number]
type CountdownOption = BaseCountdownOption | 40

const isCountdownOption = (value: number, allow40: boolean): value is CountdownOption =>
  (baseCountdownOptions as readonly number[]).includes(value) || (allow40 && value === 40)

const getQuestionCodeFromMeta = (meta?: Record<string, unknown> | null) => {
  if (!meta || typeof meta !== 'object') return null
  const raw = meta.code
  const trimmed = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  return trimmed || null
}

function isWaitingScreenOn(questionState: string | null | undefined) {
  return questionState === 'hidden'
}

type MatchRound = {
  id: string
  round_type: string
  order_index: number
}

type SoundFileOption = {
  name: string
  path: string
  url: string
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
  currentQuestionMeta?: Record<string, unknown> | null
  onTimerPing?: (payload: { durationMs: number; deadline: string }) => void
}

function getAutoTimerDurationSeconds(
  roundType: string | null,
  questionMeta?: Record<string, unknown> | null,
  questionState?: string | null
): number {
  const constraints = getDurationInputConstraints()
  let newDuration = constraints.defaultSeconds

  if (roundType === 've_dich' && questionState === 'answer_revealed') {
    newDuration = 5
  } else if (roundType === 've_dich') {
    // Lấy ve_dich_value từ meta hoặc default 20
    const veDichValue = (questionMeta?.ve_dich_value as number) || 20
    newDuration = veDichValue === 30 ? 20 : 15 // 30 điểm = 20s, 20 điểm = 15s
  } else if (roundType === 'tang_toc') {
    const questionCode = getQuestionCodeFromMeta(questionMeta)
    if (questionCode === 'TT4') {
      return 40
    }
    // Lấy order_index từ meta để xác định duration
    const orderIndex = (questionMeta?.order_index as number) ?? -1
    if (orderIndex >= 0 && orderIndex < 4) {
      // Câu 1-2: 20s, Câu 3-4: 30s
      newDuration = orderIndex < 2 ? 20 : 30
    } else {
      newDuration = 20 // Default câu 1
    }
  } else if (roundType === 'khoi_dong') {
    newDuration = Math.round(getCountdownMs('khoi_dong') / 1000)
  } else if (roundType === 'vcnv') {
    newDuration = Math.round(getCountdownMs('vcnv') / 1000)
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
  currentQuestionMeta,
  onTimerPing,
}: CountdownControlsProps) {
  const [timerDurationSeconds, setTimerDurationSeconds] = useState<number>(() =>
    getAutoTimerDurationSeconds(currentRoundType, currentQuestionMeta, currentQuestionState)
  )
  const [hasUserEditedDuration, setHasUserEditedDuration] = useState<boolean>(false)
  const [realtimeTimerDeadline, setRealtimeTimerDeadline] = useState<string | null>(null)
  const [countdownTick, setCountdownTick] = useState<number>(0)
  const [, startTimerTransition] = useTransition()

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const effectiveTimerDeadline = useMemo(() => {
    return realtimeTimerDeadline ?? timerDeadline ?? null
  }, [realtimeTimerDeadline, timerDeadline])

  const autoTimerDurationSeconds = useMemo(() => {
    return getAutoTimerDurationSeconds(currentRoundType, currentQuestionMeta, currentQuestionState)
  }, [currentRoundType, currentQuestionMeta, currentQuestionState])

  const questionCode = useMemo(
    () => getQuestionCodeFromMeta(currentQuestionMeta),
    [currentQuestionMeta]
  )
  const allowFortySeconds = currentRoundType === 'tang_toc' && questionCode === 'TT4'
  const countdownOptions = useMemo<CountdownOption[]>(
    () => (allowFortySeconds ? [...baseCountdownOptions, 40] : [...baseCountdownOptions]),
    [allowFortySeconds]
  )

  const isVeDichReveal = currentRoundType === 've_dich' && currentQuestionState === 'answer_revealed'
  const effectiveHasUserEditedDuration = hasUserEditedDuration && !isVeDichReveal
  const effectiveTimerDurationSeconds = effectiveHasUserEditedDuration
    ? timerDurationSeconds
    : autoTimerDurationSeconds
  const effectiveDurationOverride = isVeDichReveal ? 5 : effectiveTimerDurationSeconds

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
    if (!Number.isFinite(deadline)) return null
    const diffMs = deadline - now
    const seconds = Math.max(0, Math.ceil(diffMs / 1000))
    if (seconds <= 0) return null
    return seconds
  }, [effectiveTimerDeadline, countdownTick])

  const durationSecondsValue = useMemo<CountdownOption>(() => {
    const raw = effectiveDurationOverride
    if (isCountdownOption(raw, allowFortySeconds)) return raw
    return countdownOptions[0]
  }, [allowFortySeconds, countdownOptions, effectiveDurationOverride])

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
      if (!Number.isFinite(deadline)) return
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
    sessionId &&
    currentRoundQuestionId &&
    (currentQuestionState === 'showing' ||
      (currentRoundType === 've_dich' && currentQuestionState === 'answer_revealed'))
  )

  const canExpireTimer = Boolean(
    sessionId &&
    currentRoundQuestionId &&
    (currentQuestionState === 'showing' ||
      (currentRoundType === 've_dich' && currentQuestionState === 'answer_revealed')) &&
    (currentRoundType === 'vcnv' || currentRoundType === 'tang_toc' || currentRoundType === 've_dich') &&
    (currentRoundType === 've_dich' || Boolean(effectiveTimerDeadline))
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">Countdown:</Label>
        <select
          value={durationSecondsValue}
          onChange={(e) => {
            const val = Number(e.target.value)
            if (!Number.isFinite(val) || !isCountdownOption(val, allowFortySeconds)) return
            setHasUserEditedDuration(true)
            setTimerDurationSeconds(val)
          }}
          disabled={countdownSeconds !== null}
          className="h-8 w-24 rounded-md border border-slate-200 bg-white px-2 text-xs"
          aria-label="Thời gian countdown"
        >
          {countdownOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}s
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-end gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const durationMs = durationSecondsValue * 1000

            // Validate durationMs là số hợp lệ
            if (!Number.isFinite(durationMs) || durationMs <= 0) {
              return
            }

            formData.set('durationMs', String(durationMs))

            const nextDeadlineIso = new Date(Date.now() + durationMs).toISOString()
            setRealtimeTimerDeadline(nextDeadlineIso)
            onTimerPing?.({ durationMs, deadline: nextDeadlineIso })

            startTimerTransition(() => timerStartAction(formData))
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
            startTimerTransition(() => timerExpireAction(formData))
          }}
        >
          <input type="hidden" name="sessionId" value={sessionId ?? ''} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!canExpireTimer || timerExpirePending || (countdownSeconds === null && currentRoundType !== 've_dich')}
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
  currentQuestionMeta?: Record<string, unknown> | null

  setLiveSessionRoundAction: HostControlAction
  setWaitingScreenAction: HostControlAction
  setScoreboardOverlayAction: HostControlAction
  setAnswersOverlayAction: HostControlAction
  setBuzzerEnabledAction: HostControlAction
  setRoundQuestionTargetPlayerAction: HostControlAction
  endKhoiDongTurnAction: HostControlAction

  startSessionTimerAutoAction: HostControlAction
  expireSessionTimerAction: HostControlAction
  setGuestMediaControlAction: HostControlAction
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
  currentQuestionMeta,
  setLiveSessionRoundAction,
  setWaitingScreenAction,
  setScoreboardOverlayAction,
  setAnswersOverlayAction,
  setBuzzerEnabledAction,
  setRoundQuestionTargetPlayerAction,
  endKhoiDongTurnAction,
  startSessionTimerAutoAction,
  expireSessionTimerAction,
  setGuestMediaControlAction,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const baseParams = useMemo(() => new URLSearchParams(searchParams?.toString()), [searchParams])
  const [, startTargetTransition] = useTransition()
  const [, startRoundTransition] = useTransition()
  const [, startBuzzerTransition] = useTransition()
  const [, startViewModeTransition] = useTransition()

  const { sendBroadcast } = useHostBroadcast(sessionId ?? null)

  const [effectiveCurrentRoundQuestionId, setEffectiveCurrentRoundQuestionId] = useState<string | null>(() => currentRoundQuestionId ?? null)
  const [effectiveCurrentQuestionState, setEffectiveCurrentQuestionState] = useState<string | null>(() => currentQuestionState ?? null)
  const [effectiveTimerDeadline, setEffectiveTimerDeadline] = useState<string | null>(() => timerDeadline ?? null)
  const [effectiveBuzzerEnabled, setEffectiveBuzzerEnabled] = useState<boolean | null>(() => buzzerEnabled ?? null)
  const [effectiveShowScoreboardOverlay, setEffectiveShowScoreboardOverlay] = useState<boolean | null>(() => showScoreboardOverlay ?? null)
  const [effectiveShowAnswersOverlay, setEffectiveShowAnswersOverlay] = useState<boolean | null>(() => showAnswersOverlay ?? null)
  const [effectiveCurrentRoundType, setEffectiveCurrentRoundType] = useState<string | null>(() => currentRoundType ?? null)

  const handleTimerPing = useCallback(
    (payload: { durationMs: number; deadline: string }) => {
      if (!sessionId) return
      const timerPing: TimerPingPayload = {
        matchId,
        sessionId,
        roundQuestionId: effectiveCurrentRoundQuestionId ?? null,
        action: 'start',
        deadline: payload.deadline,
        durationMs: payload.durationMs,
        clientTs: Date.now(),
      }
      sendBroadcast('timer_ping', timerPing)
    },
    [effectiveCurrentRoundQuestionId, matchId, sendBroadcast, sessionId]
  )

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
  const [endTurnState, endTurnAction, endTurnPending] = useActionState(endKhoiDongTurnAction, initialState)
  const [timerStartState, timerStartAction, timerStartPending] = useActionState(startSessionTimerAutoAction, initialState)
  const [timerExpireState, timerExpireAction, timerExpirePending] = useActionState(expireSessionTimerAction, initialState)
  const [mediaState, mediaAction, mediaPending] = useActionState(setGuestMediaControlAction, initialState)

  const bucketBase = 'https://fbxrlpiigoviphaxmstd.supabase.co/storage/v1/object/public/olympia-024/media/'
  const introCommon = useMemo(
    () => `${bucketBase}O24_intro_comp.mp4`,
    []
  )
  const introRounds = useMemo(
    () => [1, 2, 3, 4].map((i) => `${bucketBase}O24_intro_game${i}_comp.mp4`),
    []
  )
  const introRules = useMemo(
    () => [1, 2, 3, 4].map((i) => `${bucketBase}NVTOT_rules_O24_game${i}_comp.mp4`),
    []
  )

  const [introMode, setIntroMode] = useState<'common' | 'round'>('common')
  const [selectedRound, setSelectedRound] = useState<number>(1)

  const preloadVideos = useCallback(
    async (urls: string[]) => {
      const urlsToLoad = urls.filter((u) => Boolean(u))
      const sessionKey = `intro_videos_preloaded_${matchId}`
      const cached = sessionStorage.getItem(sessionKey)
      if (cached === 'true') return

      await Promise.allSettled(
        urlsToLoad.map(
          (url) =>
            new Promise<void>((resolve) => {
              const bump = () => void 0
              const timeout = setTimeout(bump, 10000)
              const video = document.createElement('video')
              video.src = url
              video.preload = 'auto'
              video.addEventListener('canplay', () => {
                clearTimeout(timeout)
                resolve()
              })
              video.addEventListener('error', () => {
                clearTimeout(timeout)
                resolve()
              })
            })
        )
      )

      sessionStorage.setItem(sessionKey, 'true')
    },
    [matchId]
  )

  useEffect(() => {
    void preloadVideos([introCommon, ...introRounds, ...introRules])
  }, [matchId, introCommon, introRounds, introRules, preloadVideos])


  const roundFormRef = useRef<HTMLFormElement | null>(null)
  const buzzerFormRef = useRef<HTMLFormElement | null>(null)
  const targetFormRef = useRef<HTMLFormElement | null>(null)
  const khuyetAudioRef = useRef<HTMLAudioElement | null>(null)
  const hostAudioRef = useRef<HTMLAudioElement | null>(null)

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
  const [soundOptions, setSoundOptions] = useState<SoundFileOption[]>([])
  const [selectedSoundPath, setSelectedSoundPath] = useState<string>('')
  const [isSoundLoading, setIsSoundLoading] = useState<boolean>(false)
  const soundPrefix = 'Olympia Sound'

  type StorageListItem = {
    name: string
    id: string | null
    metadata?: { size?: number | null } | null
  }

  const isSoundFileName = (value: string) => {
    const lower = value.toLowerCase()
    return lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.endsWith('.m4a')
  }

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

  const submitToggleAction = (
    start: React.TransitionStartFunction,
    dispatch: FormActionDispatch,
    enabled: boolean
  ) => {
    const fd = new FormData()
    fd.set('matchId', matchId)
    fd.set('enabled', enabled ? '1' : '0')

    start(() => {
      dispatch(fd)
    })
  }

  const playKhuyet = useCallback(() => {
    try {
      if (!khuyetAudioRef.current) return
      khuyetAudioRef.current.currentTime = 0
      void khuyetAudioRef.current.play()
    } catch (e) {
      void e
    }
  }, [])

  const selectedSoundUrl = useMemo(() => {
    const selected = soundOptions.find((opt) => opt.path === selectedSoundPath) ?? null
    return selected?.url ?? null
  }, [soundOptions, selectedSoundPath])

  useEffect(() => {
    let active = true

    const loadSounds = async () => {
      setIsSoundLoading(true)
      try {
        const supabase = await getSupabase()
        const nextOptions: SoundFileOption[] = []
        const visitedPrefixes = new Set<string>()
        const prefixesToTry = [soundPrefix, soundPrefix.replace(/\s/g, '%20')].filter(
          (val, idx, arr) => val && arr.indexOf(val) === idx
        )

        const walk = async (prefix: string) => {
          if (!active) return
          if (visitedPrefixes.has(prefix)) return
          visitedPrefixes.add(prefix)
          const { data, error } = await supabase.storage.from('olympia').list(prefix, { limit: 1000 })
          if (!active) return
          if (error) throw error

          const items = (data ?? []) as StorageListItem[]
          for (const item of items) {
            if (!active) return
            const rawName = item.name
            const name = typeof rawName === 'string' ? rawName.trim() : ''
            if (!name) continue
            const fullPath = `${prefix}/${name}`
            const isFile = isSoundFileName(name)

            if (!isFile && item.id === null) {
              await walk(fullPath)
              continue
            }

            if (!isFile) continue
            const url = supabase.storage.from('olympia').getPublicUrl(fullPath).data.publicUrl
            const displayName = fullPath.startsWith(`${soundPrefix}/`)
              ? fullPath.slice(soundPrefix.length + 1)
              : fullPath
            nextOptions.push({ name: displayName, path: fullPath, url })
          }
        }

        for (const prefix of prefixesToTry) {
          await walk(prefix)
        }
        if (!active) return
        nextOptions.sort((a, b) => a.name.localeCompare(b.name, 'vi'))

        setSoundOptions(nextOptions)
        setSelectedSoundPath((prev) => (prev ? prev : nextOptions[0]?.path ?? ''))
      } catch {
        if (!active) return
        toast.error('Không thể tải danh sách âm thanh.')
        setSoundOptions([])
      } finally {
        if (active) setIsSoundLoading(false)
      }
    }

    void loadSounds()

    return () => {
      active = false
    }
  }, [])


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
  const endTurnMessage = endTurnState.error ?? endTurnState.success

  const canPickTarget = Boolean(
    allowTargetSelection && (isVeDichLike || effectiveCurrentRoundQuestionId || isKhoiDong)
  )
  const canEndKhoiDongTurn = Boolean(isKhoiDong || isVeDich)

  // Show toasts for messages
  useEffect(() => {
    const message = roundState.error ?? roundState.success
    if (!message) return

    if (roundState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [roundState, router])

  useEffect(() => {
    const message = waitingState.error ?? waitingState.success
    if (!message) return

    if (waitingState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [waitingState, router])

  useEffect(() => {
    const message = scoreboardState.error ?? scoreboardState.success
    if (!message) return

    if (scoreboardState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [scoreboardState, router])

  useEffect(() => {
    const message = answersState.error ?? answersState.success
    if (!message) return

    if (answersState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [answersState, router])

  useEffect(() => {
    const message = timerStartState.error ?? timerStartState.success
    if (!message) return

    if (timerStartState.error) toast.error(message)
    else toast.success(message)
  }, [timerStartState])

  useEffect(() => {
    const message = timerExpireState.error ?? timerExpireState.success
    if (!message) return

    if (timerExpireState.error) toast.error(message)
    else toast.success(message)
  }, [timerExpireState])

  useEffect(() => {
    const message = buzzerState.error ?? buzzerState.success
    if (!message) return

    if (buzzerState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [buzzerState, router])

  useEffect(() => {
    const message = targetState.error ?? targetState.success
    if (!message) return

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
  }, [targetState, router])

  useEffect(() => {
    const message = endTurnState.error ?? endTurnState.success
    if (!message) return

    if (endTurnState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [endTurnState])

  useEffect(() => {
    const message = mediaState.error ?? mediaState.success
    if (!message) return

    if (mediaState.error) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [mediaState])

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

    if (sessionId) {
      const payload: QuestionPingPayload = {
        matchId,
        sessionId,
        questionState: next === 'waiting' ? 'hidden' : 'showing',
        showScoreboardOverlay: nextScoreboard,
        showAnswersOverlay: nextAnswers,
        clientTs: Date.now(),
      }
      sendBroadcast('question_ping', payload)
    }

    submitToggleAction(startViewModeTransition, waitingAction, nextWaiting)
    submitToggleAction(startViewModeTransition, scoreboardAction, nextScoreboard)
    submitToggleAction(startViewModeTransition, answersAction, nextAnswers)
  }


  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label className="text-xs">Âm thanh</Label>
        <div className="flex items-center justify-between gap-2">
          <select
            value={selectedSoundPath}
            onChange={(e) => setSelectedSoundPath(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
            aria-label="Chọn âm thanh"
            disabled={isSoundLoading || soundOptions.length === 0}
          >
            {soundOptions.length === 0 ? (
              <option value="">{isSoundLoading ? 'Đang tải âm thanh…' : 'Không có âm thanh'}</option>
            ) : null}
            {soundOptions.map((opt) => (
              <option key={opt.path} value={opt.path}>
                {opt.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => playKhuyet()}
            title="Phát âm thanh khuyết trên trình duyệt của host"
            aria-label="Phát khuyết"
          >
            Phát khuyết
          </Button>
        </div>
        {selectedSoundUrl ? (
          <audio ref={hostAudioRef} controls src={selectedSoundUrl} className="w-full" />
        ) : (
          <p className="text-xs text-muted-foreground">Chưa chọn âm thanh.</p>
        )}
        <audio
          ref={khuyetAudioRef}
          src="https://fbxrlpiigoviphaxmstd.supabase.co/storage/v1/object/public/olympia/Olympia%20Sound/khuyet.mp3"
          preload="auto"
          hidden
        />
      </div>
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
        currentQuestionMeta={currentQuestionMeta}
        onTimerPing={handleTimerPing}
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

      {isKhoiDong || isVeDich ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            if (sessionId) {
              const soundRoundType =
                effectiveCurrentRoundType === 'khoi_dong' ||
                  effectiveCurrentRoundType === 'vcnv' ||
                  effectiveCurrentRoundType === 'tang_toc' ||
                  effectiveCurrentRoundType === 've_dich'
                  ? effectiveCurrentRoundType
                  : null
              const payload: SoundPingPayload = {
                matchId,
                sessionId,
                event: 'ROUND_ENDED',
                roundType: soundRoundType,
                clientTs: Date.now(),
              }
              sendBroadcast('sound_ping', payload)
            }
            startRoundTransition(() => endTurnAction(formData))
          }}
        >
          <input type="hidden" name="matchId" value={matchId} />
          <div className="flex items-center justify-between">
            <Label className="text-xs">Kết thúc lượt thí sinh</Label>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={!canEndKhoiDongTurn || endTurnPending}
              aria-label="Kết thúc lượt thí sinh"
              title="Kết thúc lượt (reset câu đang live về màn chờ)"
            >
              Kết thúc lượt
            </Button>
          </div>
          {endTurnMessage && !endTurnState.error ? (
            <p className="text-xs text-green-600">{endTurnMessage}</p>
          ) : null}
        </form>
      ) : null}

      <div className="grid gap-2">
        <Label className="text-xs">Intro video</Label>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="introMode"
              value="common"
              checked={introMode === 'common'}
              onChange={() => setIntroMode('common')}
              disabled={mediaPending}
            />
            Intro chung
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="introMode"
              value="round"
              checked={introMode === 'round'}
              onChange={() => setIntroMode('round')}
              disabled={mediaPending}
            />
            Intro vòng
          </label>
        </div>

        {introMode === 'round' && (
          <div className="flex items-center gap-2">
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(Number(e.target.value))}
              className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              disabled={mediaPending}
              aria-label="Chọn vòng"
            >
              {[1, 2, 3, 4].map((i) => (
                <option key={i} value={i}>
                  Vòng {i}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const mediaSrcs =
                introMode === 'common'
                  ? [introCommon]
                  : [introRounds[selectedRound - 1], introRules[selectedRound - 1]]
              if (!matchId) {
                toast.error('ID trận không hợp lệ.')
                return
              }
              // Debug: show what we're about to send
              console.info('[Host][GuestMedia] send play', { matchId, mediaSrcs })
              toast.info(`Gửi intro → ${mediaSrcs.filter(Boolean).join(', ')}`)
              const formData = new FormData(e.currentTarget)
              formData.set('matchId', String(matchId))
              formData.set('mediaType', 'video')
              formData.set('command', 'play')
              formData.set('mediaSrcs', JSON.stringify(mediaSrcs.filter(Boolean)))
              startTargetTransition(() => mediaAction(formData))
            }}
            className="flex-1"
          >
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8 w-full"
              disabled={mediaPending}
              title="Phát intro"
              aria-label="Phát intro"
            >
              <Play className="h-4 w-4 mr-1" />
              Phát
            </Button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!matchId) {
                toast.error('ID trận không hợp lệ.')
                return
              }
              console.info('[Host][GuestMedia] send pause', { matchId })
              toast.info('Gửi lệnh tạm dừng intro')
              const formData = new FormData(e.currentTarget)
              formData.set('matchId', String(matchId))
              formData.set('mediaType', 'video')
              formData.set('command', 'pause')
              startTargetTransition(() => mediaAction(formData))
            }}
            className="flex-1"
          >
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8 w-full"
              disabled={mediaPending}
              title="Tạm dừng intro"
              aria-label="Tạm dừng intro"
            >
              <Pause className="h-4 w-4 mr-1" />
              Tạm dừng
            </Button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!matchId) {
                toast.error('ID trận không hợp lệ.')
                return
              }
              console.info('[Host][GuestMedia] send stop', { matchId })
              toast.info('Gửi lệnh dừng intro')
              const formData = new FormData(e.currentTarget)
              formData.set('matchId', String(matchId))
              formData.set('mediaType', 'video')
              formData.set('command', 'stop')
              startTargetTransition(() => mediaAction(formData))
            }}
            className="flex-1"
          >
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8 w-full"
              disabled={mediaPending}
              title="Dừng intro"
              aria-label="Dừng intro"
            >
              <Square className="h-4 w-4 mr-1" />
              Dừng
            </Button>
          </form>
        </div>
      </div>

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

              submitToggleAction(startBuzzerTransition, buzzerAction, next)
            }}
            disabled={!effectiveCurrentRoundType || buzzerPending}
          />

        </div>
        {buzzerMessage && !buzzerState.error ? <p className="text-xs text-green-600">{buzzerMessage}</p> : null}
      </form>

    </div>
  )
}
