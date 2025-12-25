'use client'

import type { ReactNode } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { setLiveSessionRoundAction, setQuestionStateAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

const roundLabelMap: Record<string, string> = {
  khoi_dong: 'Khởi động',
  vcnv: 'Vượt chướng ngại vật',
  tang_toc: 'Tăng tốc',
  ve_dich: 'Về đích',
}

const questionStateLabel: Record<string, string> = {
  hidden: 'Ẩn nội dung',
  showing: 'Đang hiển thị',
  answer_revealed: 'Đã mở đáp án',
  completed: 'Hoàn tất câu hỏi',
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
    <Button type="submit" size="sm" className="w-full" disabled={isDisabled}>
      {pending ? 'Đang cập nhật…' : children}
    </Button>
  )
}

export function HostRoundControls({ matchId, rounds, currentQuestionState, currentRoundType }: Props) {
  const [roundState, roundAction] = useActionState(setLiveSessionRoundAction, initialState)
  const [questionState, questionAction] = useActionState(setQuestionStateAction, initialState)

  const roundMessage = roundState.error ?? roundState.success
  const questionMessage = questionState.error ?? questionState.success

  // Show toasts for messages
  useEffect(() => {
    if (roundState.error) {
      toast.error(roundState.error)
    } else if (roundState.success) {
      toast.success(roundState.success)
    }
  }, [roundState.error, roundState.success])

  useEffect(() => {
    if (questionState.error) {
      toast.error(questionState.error)
    } else if (questionState.success) {
      toast.success(questionState.success)
    }
  }, [questionState.error, questionState.success])

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form action={roundAction} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <input type="hidden" name="matchId" value={matchId} />
        <Label>Chuyển vòng</Label>
        <select
          name="roundType"
          defaultValue={currentRoundType ?? ''}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          required
        >
          <option value="" disabled>
            Chọn vòng thi
          </option>
          {rounds.map((round) => (
            <option key={round.id} value={round.round_type}>
              Vòng {round.order_index + 1}: {roundLabelMap[round.round_type] ?? round.round_type}
            </option>
          ))}
        </select>
        <SubmitButton disabled={rounds.length === 0}>Đặt vòng hiện tại</SubmitButton>
        {roundMessage && !roundState.error ? (
          <p className="text-xs text-green-600">{roundMessage}</p>
        ) : null}
      </form>

      <form action={questionAction} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <input type="hidden" name="matchId" value={matchId} />
        <Label>Trạng thái câu hỏi</Label>
        <select
          name="questionState"
          defaultValue={currentQuestionState ?? ''}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          required
        >
          <option value="" disabled>
            Chọn trạng thái
          </option>
          {Object.entries(questionStateLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <SubmitButton disabled={!currentRoundType}>Cập nhật trạng thái</SubmitButton>
        {questionMessage && !questionState.error ? (
          <p className="text-xs text-green-600">{questionMessage}</p>
        ) : null}
      </form>
    </div>
  )
}
