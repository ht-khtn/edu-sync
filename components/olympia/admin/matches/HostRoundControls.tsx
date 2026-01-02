'use client'

import { useMemo, useRef, useState } from 'react'
import { useActionState } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { setBuzzerEnabledAction, setLiveSessionRoundAction, setRoundQuestionTargetPlayerAction, setWaitingScreenAction, type ActionState } from '@/app/(olympia)/olympia/actions'

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
  allowTargetSelection?: boolean
  currentRoundQuestionId?: string | null
  currentTargetPlayerId?: string | null
  isKhoiDong?: boolean
}

export function HostRoundControls({
  matchId,
  rounds,
  players,
  currentQuestionState,
  currentRoundType,
  buzzerEnabled,
  allowTargetSelection,
  currentRoundQuestionId,
  currentTargetPlayerId,
  isKhoiDong,
}: Props) {
  const router = useRouter()
  const [roundState, roundAction] = useActionState(setLiveSessionRoundAction, initialState)
  const [waitingState, waitingAction] = useActionState(setWaitingScreenAction, initialState)
  const [buzzerState, buzzerAction] = useActionState(setBuzzerEnabledAction, initialState)
  const [targetState, targetAction] = useActionState(setRoundQuestionTargetPlayerAction, initialState)

  const roundFormRef = useRef<HTMLFormElement | null>(null)
  const waitingFormRef = useRef<HTMLFormElement | null>(null)
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
  const [buzzerChecked, setBuzzerChecked] = useState<boolean>(() => (buzzerEnabled ?? true))

  const roundMessage = roundState.error ?? roundState.success
  const waitingMessage = waitingState.error ?? waitingState.success
  const buzzerMessage = buzzerState.error ?? buzzerState.success

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
  }, [currentRound?.id])

  useEffect(() => {
    setTargetPlayerId(currentTargetPlayerId ?? '')
  }, [currentTargetPlayerId])

  useEffect(() => {
    setWaitingChecked(isWaitingScreenOn(currentQuestionState))
  }, [currentQuestionState])

  useEffect(() => {
    // mặc định bật nếu chưa có dữ liệu (trước khi migrate)
    setBuzzerChecked(buzzerEnabled ?? true)
  }, [buzzerEnabled])

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
              if (nextId) {
                queueMicrotask(() => roundFormRef.current?.requestSubmit())
              }
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
        </div>
        {roundMessage && !roundState.error ? (
          <p className="text-xs text-green-600">{roundMessage}</p>
        ) : null}
      </form>

      {allowTargetSelection && currentRoundQuestionId && players && players.length > 0 ? (
        <form ref={targetFormRef} action={targetAction} className="grid gap-2">
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="roundQuestionId" value={currentRoundQuestionId} />
          <Label className="sr-only">Chọn thí sinh</Label>
          <select
            name="playerId"
            value={targetPlayerId}
            onChange={(e) => {
              const next = e.target.value
              setTargetPlayerId(next)
              queueMicrotask(() => targetFormRef.current?.requestSubmit())
            }}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            aria-label="Chọn thí sinh"
          >
            <option value="">{isKhoiDong ? 'Vòng thi chung (DKA)' : '(Tuỳ vòng) Chọn thí sinh'}</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name ?? (p.seat_index != null ? `Ghế ${p.seat_index}` : 'Thí sinh')}
              </option>
            ))}
          </select>
        </form>
      ) : null}

      <form ref={waitingFormRef} action={waitingAction} className="grid gap-2">
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="enabled" value={waitingChecked ? '1' : '0'} />
        <div className="flex items-center justify-between">
          <Label className="text-xs">Màn chờ</Label>
          <Switch
            checked={waitingChecked}
            onCheckedChange={(v) => {
              const next = Boolean(v)
              setWaitingChecked(next)
              // Submit ngay để host điều khiển nhanh
              queueMicrotask(() => waitingFormRef.current?.requestSubmit())
            }}
            disabled={!currentRoundType}
            aria-label="Màn chờ"
          />
        </div>
        {waitingMessage && !waitingState.error ? <p className="text-xs text-green-600">{waitingMessage}</p> : null}
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
