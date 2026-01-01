'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useActionState } from 'react'
import { verifyMcPasswordAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

type McPasswordGateProps = {
  joinCode: string
  children?: ReactNode
}

export function McPasswordGate({ joinCode, children }: McPasswordGateProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await verifyMcPasswordAction(prev, formData)
      if (result.success) {
        setUnlocked(true)
      }
      return result
    },
    initialState
  )
  const hasMessage = state.error || state.success

  if (unlocked) {
    return children ? (
      <>{children}</>
    ) : (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-semibold">Đã mở khóa chế độ MC</p>
        <p className="mt-1 text-xs">Bạn có thể xem màn hình MC ngay trên trang này.</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="joinCode" value={joinCode} />
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
