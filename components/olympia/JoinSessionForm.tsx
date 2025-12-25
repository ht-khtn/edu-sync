'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { lookupJoinCodeAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { toast } from 'sonner'

const initialState: ActionState = { error: null, success: null }

export function JoinSessionForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction] = useActionState(lookupJoinCodeAction, initialState)

  // Handle success - redirect to game page
  useEffect(() => {
    if (state.success && state.data?.sessionId) {
      toast.success('Đã xác nhận phòng thi. Đang vào phòng...')
      setTimeout(() => {
        router.push(`/olympia/client/game/${state.data!.sessionId}`)
      }, 500)
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state.success, state.error, state.data, router])

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase().trim())
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="joinCode" className="block text-sm font-medium mb-2">
          Mã tham gia
        </label>
        <Input
          id="joinCode"
          name="joinCode"
          placeholder="Ví dụ: ABC123"
          className="font-mono text-lg tracking-widest"
          value={code}
          onChange={handleCodeChange}
          required
          maxLength={10}
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor="playerPassword" className="block text-sm font-medium mb-2">
          Mật khẩu thí sinh
        </label>
        <div className="relative">
          <Input
            id="playerPassword"
            name="playerPassword"
            placeholder="••••••••"
            type={showPassword ? 'text' : 'password'}
            className="pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full gap-2" disabled={!code || !password}>
        Vào phòng thi
      </Button>

      {state.error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">
          Nhập mã phòng và mật khẩu do ban tổ chức cung cấp
        </p>
      )}
    </form>
  )
}
