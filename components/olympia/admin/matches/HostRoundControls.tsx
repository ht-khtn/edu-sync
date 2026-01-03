'use client'

import { useMemo, useRef, useState } from 'react'
import { useActionState } from 'react'
import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export type ActionState = {
  error?: string | null
  success?: string | null
  data?: Record<string, unknown> | null
}

type HostControlAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>

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

type Props = {
  matchId: string
  rounds: MatchRound[]
  players?: Array<{ id: string; seat_index: number | null; display_name: string | null }>
  currentQuestionState?: string | null
  currentRoundType?: string | null
  buzzerEnabled?: boolean | null
  showScoreboardOverlay?: boolean | null
  allowTargetSelection?: boolean
  currentRoundQuestionId?: string | null
  currentTargetPlayerId?: string | null
  isKhoiDong?: boolean

  setLiveSessionRoundAction: HostControlAction
  setWaitingScreenAction: HostControlAction
  setScoreboardOverlayAction: HostControlAction
  setBuzzerEnabledAction: HostControlAction
  setRoundQuestionTargetPlayerAction: HostControlAction
}

export function HostRoundControls({
  matchId,
  rounds,
  players,
  currentQuestionState,
  currentRoundType,
  buzzerEnabled,
  showScoreboardOverlay,
  allowTargetSelection,
  currentRoundQuestionId,
  currentTargetPlayerId,
  isKhoiDong,
  setLiveSessionRoundAction,
  setWaitingScreenAction,
  setScoreboardOverlayAction,
  setBuzzerEnabledAction,
  setRoundQuestionTargetPlayerAction,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const baseParams = useMemo(() => new URLSearchParams(searchParams?.toString()), [searchParams])

  const [roundState, roundAction] = useActionState(setLiveSessionRoundAction, initialState)
  const [waitingState, waitingAction] = useActionState(setWaitingScreenAction, initialState)
  const [scoreboardState, scoreboardAction] = useActionState(setScoreboardOverlayAction, initialState)
  const [buzzerState, buzzerAction] = useActionState(setBuzzerEnabledAction, initialState)
  const [targetState, targetAction] = useActionState(setRoundQuestionTargetPlayerAction, initialState)

  const roundFormRef = useRef<HTMLFormElement | null>(null)
  const waitingFormRef = useRef<HTMLFormElement | null>(null)
  const scoreboardFormRef = useRef<HTMLFormElement | null>(null)
  const buzzerFormRef = useRef<HTMLFormElement | null>(null)
  const targetFormRef = useRef<HTMLFormElement | null>(null)

  const roundById = useMemo(() => {
    const map = new Map<string, MatchRound>()
    for (const r of rounds) map.set(r.id, r)
    return map
  }, [rounds])

  const currentRound = rounds.find((r) => r.round_type === currentRoundType) ?? null
  const [roundId, setRoundId] = useState<string>(() => currentRound?.id ?? '')
  const selectedRoundType = roundId ? roundById.get(roundId)?.round_type ?? '' : ''

  const [targetPlayerId, setTargetPlayerId] = useState<string>(() => currentTargetPlayerId ?? '')
  const [waitingChecked, setWaitingChecked] = useState<boolean>(() => isWaitingScreenOn(currentQuestionState))
  const [scoreboardChecked, setScoreboardChecked] = useState<boolean>(() => (showScoreboardOverlay ?? false))
  const [buzzerChecked, setBuzzerChecked] = useState<boolean>(() => (buzzerEnabled ?? true))

  const roundMessage = roundState.error ?? roundState.success
  const waitingMessage = waitingState.error ?? waitingState.success
  const scoreboardMessage = scoreboardState.error ?? scoreboardState.success
  const buzzerMessage = buzzerState.error ?? buzzerState.success

  const canPickTarget = Boolean(allowTargetSelection && currentRoundQuestionId)

  // Show toasts for messages
  useEffect(() => {
    if (roundState.error) {
      toast.error(roundState.error)
    } else if (roundState.success) {
      toast.success(roundState.success)
      router.refresh()
    }
  }, [roundState.error, roundState.success, router])

  useEffect(() => {
    if (waitingState.error) {
      toast.error(waitingState.error)
    } else if (waitingState.success) {
      toast.success(waitingState.success)
    }
  }, [waitingState.error, waitingState.success, router])

  useEffect(() => {
    if (scoreboardState.error) {
      toast.error(scoreboardState.error)
    } else if (scoreboardState.success) {
      toast.success(scoreboardState.success)
    }
  }, [scoreboardState.error, scoreboardState.success, router])

  useEffect(() => {
    if (buzzerState.error) {
      toast.error(buzzerState.error)
    } else if (buzzerState.success) {
      toast.success(buzzerState.success)
    }
  }, [buzzerState.error, buzzerState.success, router])

  useEffect(() => {
    if (targetState.error) {
      toast.error(targetState.error)
    } else if (targetState.success) {
      toast.success(targetState.success)
      router.refresh()
    }
  }, [targetState.error, targetState.success, router])

  useEffect(() => {
    setRoundId(currentRound?.id ?? '')
  }, [currentRound?.id, roundState.success])

  useEffect(() => {
    setTargetPlayerId(currentTargetPlayerId ?? '')
  }, [currentTargetPlayerId, targetState.success])

  useEffect(() => {
    setWaitingChecked(isWaitingScreenOn(currentQuestionState))
  }, [currentQuestionState])

  useEffect(() => {
    setScoreboardChecked(showScoreboardOverlay ?? false)
  }, [showScoreboardOverlay])

  useEffect(() => {
    // mặc định bật nếu chưa có dữ liệu (trước khi migrate)
    setBuzzerChecked(buzzerEnabled ?? true)
  }, [buzzerEnabled])

  type HostViewMode = 'question' | 'waiting' | 'scoreboard'
  const viewMode: HostViewMode = scoreboardChecked ? 'scoreboard' : waitingChecked ? 'waiting' : 'question'

  const setHiddenEnabledAndSubmit = (form: HTMLFormElement | null, enabled: boolean) => {
    if (!form) return
    const input = form.querySelector('input[name="enabled"]')
    if (input instanceof HTMLInputElement) {
      input.value = enabled ? '1' : '0'
    }
    form.requestSubmit()
  }

  const setViewMode = (next: HostViewMode) => {
    const nextWaiting = next === 'waiting'
    const nextScoreboard = next === 'scoreboard'

    setWaitingChecked(nextWaiting)
    setScoreboardChecked(nextScoreboard)

    queueMicrotask(() => {
      setHiddenEnabledAndSubmit(waitingFormRef.current, nextWaiting)
      setHiddenEnabledAndSubmit(scoreboardFormRef.current, nextScoreboard)
    })
  }

  return (
    <div className="grid gap-3">
      <form ref={roundFormRef} action={roundAction} className="grid gap-2">
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
          <Button type="submit" size="sm" disabled={!roundId} aria-label="Chuyển vòng">
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
            action={targetAction}
            className="grid gap-2"
            onSubmit={() => {
              // Trước khi submit, update URL query param để lọc danh sách câu theo ghế được chọn
              const selectedPlayer = players.find((p) => p.id === targetPlayerId)
              const nextSeat = selectedPlayer?.seat_index
              const params = new URLSearchParams(baseParams)
              if (nextSeat != null) params.set('kdSeat', String(nextSeat))
              else params.delete('kdSeat')
              // Đổi ghế/thi chung thì reset preview để tránh chọn câu không thuộc danh sách.
              params.delete('preview')
              const qs = params.toString()
              router.replace(qs ? `${pathname}?${qs}` : pathname)
            }}
          >
            <input type="hidden" name="matchId" value={matchId} />
            <input type="hidden" name="roundQuestionId" value={currentRoundQuestionId ?? ''} />
            <Label className="sr-only">Chọn ghế (Khởi động)</Label>
            <div className="flex items-center gap-2">
              <select
                name="playerId"
                value={targetPlayerId}
                onChange={(e) => {
                  const selectedPlayerId = e.target.value
                  setTargetPlayerId(selectedPlayerId)
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                aria-label="Chọn ghế (Khởi động)"
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
              <Button type="submit" size="sm" aria-label="Xác nhận chọn ghế" title="Khởi động: chọn ghế để lọc câu, không cần chọn câu trước">
                Xác nhận
              </Button>
            </div>
          </form>
        ) : (
          <form
            ref={targetFormRef}
            action={targetAction}
            className="grid gap-2"
            onSubmit={() => {
              const params = new URLSearchParams(baseParams)
              params.delete('preview')
              const qs = params.toString()
              router.replace(qs ? `${pathname}?${qs}` : pathname)
            }}
          >
            <input type="hidden" name="matchId" value={matchId} />
            <input type="hidden" name="roundQuestionId" value={currentRoundQuestionId ?? ''} />
            <Label className="sr-only">Chọn thí sinh</Label>
            <div className="flex items-center gap-2">
              <select
                name="playerId"
                value={targetPlayerId}
                onChange={(e) => {
                  const next = e.target.value
                  setTargetPlayerId(next)
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                aria-label="Chọn thí sinh"
                disabled={!allowTargetSelection}
              >
                <option value="">
                  {!allowTargetSelection
                    ? 'Chọn thí sinh (chỉ dùng cho Về đích)'
                    : !currentRoundQuestionId
                      ? 'Chọn câu trước để gán thí sinh'
                      : '(Tuỳ vòng) Chọn thí sinh'}
                </option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    Ghế {p.seat_index ?? '—'} · {p.display_name ?? 'Thí sinh'}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" aria-label="Xác nhận chọn thí sinh" disabled={!canPickTarget}>
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
              disabled={!currentRoundType}
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
              disabled={!currentRoundType}
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
              disabled={!currentRoundType}
              aria-label="Bảng điểm"
            />
            Bảng điểm
          </label>
        </div>
        {waitingMessage && !waitingState.error ? <p className="text-xs text-green-600">{waitingMessage}</p> : null}
        {scoreboardMessage && !scoreboardState.error ? <p className="text-xs text-green-600">{scoreboardMessage}</p> : null}
      </div>

      <form ref={waitingFormRef} action={waitingAction} className="hidden" aria-hidden="true">
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="enabled" value={waitingChecked ? '1' : '0'} />
      </form>

      <form ref={scoreboardFormRef} action={scoreboardAction} className="hidden" aria-hidden="true">
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="enabled" value={scoreboardChecked ? '1' : '0'} />
      </form>

      <form ref={buzzerFormRef} action={buzzerAction} className="grid gap-2">
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="enabled" value={buzzerChecked ? '1' : '0'} />
        <div className="flex items-center justify-between">
          <Label className="text-xs">Bấm chuông</Label>
          <Switch
            checked={buzzerChecked}
            onCheckedChange={(v) => {
              const next = Boolean(v)
              setBuzzerChecked(next)
              queueMicrotask(() => buzzerFormRef.current?.requestSubmit())
            }}
            disabled={!currentRoundType}
            aria-label="Bấm chuông"
          />
        </div>
        {buzzerMessage && !buzzerState.error ? <p className="text-xs text-green-600">{buzzerMessage}</p> : null}
      </form>
    </div>
  )
}
