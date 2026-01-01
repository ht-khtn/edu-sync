'use client'

import type { ReactNode } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { setLiveSessionRoundAction, setWaitingScreenAction, type ActionState } from '@/app/(olympia)/olympia/actions'
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

export function HostRoundControls({ matchId, rounds, currentQuestionState, currentRoundType }: Props) {
  const [roundState, roundAction] = useActionState(setLiveSessionRoundAction, initialState)
  const [waitingState, waitingAction] = useActionState(setWaitingScreenAction, initialState)

  const roundMessage = roundState.error ?? roundState.success
  const waitingMessage = waitingState.error ?? waitingState.success

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

      <form action={waitingAction} className="grid gap-2">
        <input type="hidden" name="matchId" value={matchId} />
        <Label className="sr-only">Màn chờ</Label>
        <div className="flex items-center gap-2">
          {isWaitingScreenOn(currentQuestionState) ? (
            <>
              <input type="hidden" name="enabled" value="0" />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={!currentRoundType}
                title="Tắt màn chờ (hiện câu)"
                aria-label="Tắt màn chờ (hiện câu)"
              >
                Tắt màn chờ
              </Button>
            </>
          ) : (
            <>
              <input type="hidden" name="enabled" value="1" />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={!currentRoundType}
                title="Bật màn chờ (ẩn câu)"
                aria-label="Bật màn chờ (ẩn câu)"
              >
                Bật màn chờ
              </Button>
            </>
          )}
        </div>
        {waitingMessage && !waitingState.error ? (
          <p className="text-xs text-green-600">{waitingMessage}</p>
        ) : null}
      </form>
    </div>
  )
}
