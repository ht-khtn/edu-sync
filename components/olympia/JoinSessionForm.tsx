'use client'

import { useCallback, useState } from 'react'
import { useFormState } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { lookupJoinCodeAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

export function JoinSessionForm() {
  const [code, setCode] = useState('')
  const handleAction = useCallback(
    async (prevState: ActionState, formData: FormData) => {
      const result = await lookupJoinCodeAction(prevState, formData)
      if (result.success) {
        setCode('')
      }
      return result
    },
    [setCode]
  )
  const [state, formAction] = useFormState(handleAction, initialState)

  const hasMessage = state.error || state.success

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        name="joinCode"
        placeholder="Nhập mã tham gia"
        className="sm:w-60"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        required
      />
      <Button type="submit">Vào phòng</Button>
      {hasMessage ? (
        <p className={cn('text-xs sm:ml-3', state.error ? 'text-destructive' : 'text-green-600')}>
          {state.error ?? state.success}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Nhập mã do BTC cung cấp để kiểm tra trạng thái phòng.</p>
      )}
    </form>
  )
}
