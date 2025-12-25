'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Copy, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
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

function PasswordDisplay({ label, value }: { label: string; value: string }) {
  const [isVisible, setIsVisible] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm font-semibold tracking-wide">{isVisible ? value : '••••••••'}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setIsVisible(!isVisible)}
        className="h-8 w-8 p-0"
        aria-label={isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      >
        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={handleCopy}
        className="h-8 w-8 p-0"
        aria-label="Sao chép mật khẩu"
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function LiveSessionControls({ matchId, liveSession }: Props) {
  const [openState, openAction] = useActionState(openLiveSessionAction, initialState)
  const [endState, endAction] = useActionState(endLiveSessionAction, initialState)

  const message = openState.error ?? openState.success ?? endState.error ?? endState.success
  const isError = Boolean(openState.error ?? endState.error)

  // Show toasts for messages
  if (message && isError) {
    toast.error(message)
  } else if (message && openState.success) {
    toast.success(message)
  } else if (message && endState.success) {
    toast.success(message)
  }

  // Extract passwords from success message if available
  const extractPasswords = (msg: string | null | undefined) => {
    if (!msg || !msg.includes('Mật khẩu')) return { playerPassword: null, mcPassword: null }
    const playerMatch = msg.match(/Mật khẩu thí sinh: (\S+)/)
    const mcMatch = msg.match(/Mật khẩu MC: (\S+)/)
    return {
      playerPassword: playerMatch?.[1] ?? null,
      mcPassword: mcMatch?.[1] ?? null,
    }
  }

  const { playerPassword, mcPassword } = extractPasswords(openState.success)

  const disableOpen = liveSession?.status === 'running'
  const disableEnd = !liveSession || liveSession.status !== 'running'

  const statusText = liveSession?.status ? statusLabel[liveSession.status] ?? liveSession.status : 'Chưa mở'
  const questionState = liveSession?.question_state ?? '—'
  const roundLabel = liveSession?.current_round_type ?? '—'
  const joinCode = liveSession?.join_code ?? '—'

  return (
    <div className="space-y-3 text-xs">
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

      {playerPassword && mcPassword && (
        <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-xs font-semibold text-green-900">Phòng đã mở thành công!</p>
          <PasswordDisplay label="Mật khẩu thí sinh" value={playerPassword} />
          <PasswordDisplay label="Mật khẩu MC/Người dẫn" value={mcPassword} />
        </div>
      )}

      <form action={endAction} className="space-y-2">
        <input type="hidden" name="matchId" value={matchId} />
        <SubmitButton disabled={disableEnd} variant="secondary">
          {disableEnd ? 'Chưa thể kết thúc' : 'Kết thúc phòng'}
        </SubmitButton>
      </form>

      {message && !playerPassword ? (
        <p className={cn('text-xs', isError ? 'text-destructive' : 'text-green-600')}>{message}</p>
      ) : null}
    </div>
  )
}
