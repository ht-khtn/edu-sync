'use client'

import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { setBuzzerEnabledAction, setLiveSessionRoundAction, setWaitingScreenAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { Check } from 'lucide-react'

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
  currentQuestionState?: string | null
  currentRoundType?: string | null
  buzzerEnabled?: boolean | null
}

function SubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus()
  const isDisabled = pending || disabled
  return (
    <Button
      type="submit"
      size="icon-sm"
      variant="outline"
      disabled={isDisabled}
      title={pending ? 'Đang cập nhật…' : String(children)}
      aria-label={pending ? 'Đang cập nhật…' : String(children)}
    >
      <Check />
      <span className="sr-only">{pending ? 'Đang cập nhật…' : children}</span>
    </Button>
  )
}

export function HostRoundControls({ matchId, rounds, currentQuestionState, currentRoundType, buzzerEnabled }: Props) {
  const [roundState, roundAction] = useActionState(setLiveSessionRoundAction, initialState)
  const [waitingState, waitingAction] = useActionState(setWaitingScreenAction, initialState)
  const [buzzerState, buzzerAction] = useActionState(setBuzzerEnabledAction, initialState)

  const waitingFormRef = useRef<HTMLFormElement | null>(null)
  const buzzerFormRef = useRef<HTMLFormElement | null>(null)

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
    }
  }, [roundState.error, roundState.success])

  useEffect(() => {
    if (waitingState.error) {
      toast.error(waitingState.error)
    } else if (waitingState.success) {
      toast.success(waitingState.success)
    }
  }, [waitingState.error, waitingState.success])

  useEffect(() => {
    if (buzzerState.error) {
      toast.error(buzzerState.error)
    } else if (buzzerState.success) {
      toast.success(buzzerState.success)
    }
  }, [buzzerState.error, buzzerState.success])

  useEffect(() => {
    setWaitingChecked(isWaitingScreenOn(currentQuestionState))
  }, [currentQuestionState])

  useEffect(() => {
    // mặc định bật nếu chưa có dữ liệu (trước khi migrate)
    setBuzzerChecked(buzzerEnabled ?? true)
  }, [buzzerEnabled])

  return (
    <div className="grid gap-3">
      <form action={roundAction} className="grid gap-2">
        <input type="hidden" name="matchId" value={matchId} />
        <Label className="sr-only">Chuyển vòng</Label>
        <div className="flex items-center gap-2">
          <select
            name="roundType"
            defaultValue={currentRoundType ?? ''}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            required
            aria-label="Chọn vòng"
          >
            <option value="" disabled>
              Chọn vòng
            </option>
            {rounds.map((round) => (
              <option key={round.id} value={round.round_type}>
                Vòng {round.order_index + 1}: {roundLabelMap[round.round_type] ?? round.round_type}
              </option>
            ))}
          </select>
          <SubmitButton disabled={rounds.length === 0}>Đặt vòng</SubmitButton>
        </div>
        {roundMessage && !roundState.error ? (
          <p className="text-xs text-green-600">{roundMessage}</p>
        ) : null}
      </form>

      <form ref={waitingFormRef} action={waitingAction} className="grid gap-2">
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="enabled" value={waitingChecked ? '1' : '0'} />
        <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3">
          <Label className="text-sm">Màn chờ</Label>
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
        <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3">
          <Label className="text-sm">Bấm chuông</Label>
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
