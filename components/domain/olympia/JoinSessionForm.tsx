'use client'

import { useEffect, useState } from 'react'
import { useFormState } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { lookupJoinCodeAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

export function JoinSessionForm() {
  const [state, formAction] = useFormState(lookupJoinCodeAction, initialState)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (state.success) {
      setCode('')
    }
  }, [state.success])

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
