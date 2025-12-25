'use client'

import type { ReactNode } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { openLiveSessionAction, endLiveSessionAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

const statusLabel: Record<string, string> = {
  running: 'Đang mở',
  pending: 'Chờ mở',
  ended: 'Đã kết thúc',
}

type LiveSessionInfo = {
  status: string | null
  join_code: string | null
  question_state: string | null
  current_round_type: string | null
}

type Props = {
  matchId: string
  liveSession?: LiveSessionInfo | null
}

function SubmitButton({ children, disabled, variant }: { children: ReactNode; disabled?: boolean; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" variant={variant ?? 'outline'} disabled={pending || disabled} className="w-full">
      {pending ? 'Đang xử lý…' : children}
    </Button>
  )
}

export function LiveSessionControls({ matchId, liveSession }: Props) {
  const [openState, openAction] = useActionState(openLiveSessionAction, initialState)
  const [endState, endAction] = useActionState(endLiveSessionAction, initialState)

  const message = openState.error ?? openState.success ?? endState.error ?? endState.success
  const isError = Boolean(openState.error ?? endState.error)

  const disableOpen = liveSession?.status === 'running'
  const disableEnd = !liveSession || liveSession.status !== 'running'

  const statusText = liveSession?.status ? statusLabel[liveSession.status] ?? liveSession.status : 'Chưa mở'
  const questionState = liveSession?.question_state ?? '—'
  const roundLabel = liveSession?.current_round_type ?? '—'
  const joinCode = liveSession?.join_code ?? '—'

  return (
    <div className="space-y-2 text-xs">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={disableOpen ? 'default' : 'secondary'}>{statusText}</Badge>
          <span className="font-mono text-sm tracking-wider">{joinCode}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Vòng hiện tại: {roundLabel}</p>
        <p className="text-[11px] text-muted-foreground">Trạng thái câu hỏi: {questionState}</p>
      </div>

      <form action={openAction} className="space-y-2">
        <input type="hidden" name="matchId" value={matchId} />
        <SubmitButton disabled={disableOpen} variant="default">
          {disableOpen ? 'Đang mở' : 'Mở phòng cho trận này'}
        </SubmitButton>
      </form>

      <form action={endAction} className="space-y-2">
        <input type="hidden" name="matchId" value={matchId} />
        <SubmitButton disabled={disableEnd} variant="secondary">
          {disableEnd ? 'Chưa thể kết thúc' : 'Kết thúc phòng'}
        </SubmitButton>
      </form>

      {message ? (
        <p className={cn('text-[11px]', isError ? 'text-destructive' : 'text-green-600')}>{message}</p>
      ) : null}
    </div>
  )
}
