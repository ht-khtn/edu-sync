'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { lookupJoinCodeAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

export function JoinSessionForm() {
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [state, formAction] = useActionState(lookupJoinCodeAction, initialState)

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
      <Input
        name="playerPassword"
        placeholder="Mật khẩu thí sinh"
        type="password"
        className="sm:w-48"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <Button type="submit">Vào phòng</Button>
      {hasMessage ? (
        <p className={cn('text-xs sm:ml-3', state.error ? 'text-destructive' : 'text-green-600')}>
          {state.error ?? state.success}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Nhập mã phòng và mật khẩu thí sinh do BTC cung cấp.</p>
      )}
    </form>
  )
}
