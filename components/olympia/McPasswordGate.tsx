'use client'

import { useCallback, useState } from 'react'
import { useFormState } from 'react-dom'
import { verifyMcPasswordAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

type McPasswordGateProps = {
  matchId: string
}

export function McPasswordGate({ matchId }: McPasswordGateProps) {
  const [unlocked, setUnlocked] = useState(false)
  const handler = useCallback(async (prev: ActionState, formData: FormData) => {
    const result = await verifyMcPasswordAction(prev, formData)
    if (result.success) {
      setUnlocked(true)
    }
    return result
  }, [matchId])
  const [state, formAction] = useFormState(handler, initialState)
  const hasMessage = state.error || state.success

  if (unlocked) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-semibold">Đã mở khóa chế độ MC</p>
        <p className="mt-1 text-xs">
          Từ giờ bạn sẽ thấy đầy đủ trạng thái câu hỏi, điểm số và log realtime (UI sẽ cập nhật khi hoàn thiện console watch).
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="matchId" value={matchId} />
      <div>
        <label htmlFor="mcPassword" className="text-sm font-medium">
          Nhập mật khẩu MC
        </label>
        <Input id="mcPassword" name="mcPassword" type="password" placeholder="******" required autoComplete="off" />
      </div>
      <Button type="submit" className="w-full">
        Xác thực
      </Button>
      {hasMessage ? (
        <p className={cn('text-xs', state.error ? 'text-destructive' : 'text-green-600')}>
          {state.error ?? state.success}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Mật khẩu MC do ban tổ chức cung cấp (khác với mật khẩu thí sinh).
        </p>
      )}
    </form>
  )
}
