'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useEffect } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { lookupJoinCodeAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { toast } from 'sonner'
import type { LiveSessionRow } from '@/types/olympia/game'
import { OlympiaAccountMenu } from '@/components/olympia/client/OlympiaAccountMenu'

const initialState: ActionState = { error: null, success: null }

type PlayerPasswordGateProps = {
  session: LiveSessionRow
  userAlreadyVerified?: boolean
  children: React.ReactNode
}

export function PlayerPasswordGate({ session, userAlreadyVerified = false, children }: PlayerPasswordGateProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [isVerified, setIsVerified] = useState(userAlreadyVerified)
  const [state, formAction] = useActionState(lookupJoinCodeAction, initialState)

  // Check if session requires password
  const requiresPassword = session.requires_player_password ?? true

  // Handle success - allow access
  useEffect(() => {
    if (state.success && state.data?.sessionId) {
      toast.success('Xác thực thành công')
      // Use requestAnimationFrame to avoid cascading renders
      const timer = requestAnimationFrame(() => {
        setIsVerified(true)
      })
      return () => cancelAnimationFrame(timer)
    } else if (state.error) {
      toast.error(state.error)
      // Use requestAnimationFrame to clear password field
      const timer = requestAnimationFrame(() => {
        setPassword('')
      })
      return () => cancelAnimationFrame(timer)
    }
  }, [state.success, state.error, state.data])

  // If no password required or already verified, show children
  if (!requiresPassword || isVerified) {
    return <>{children}</>
  }

  // Show password gate
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <OlympiaAccountMenu loginRedirectTo={`/olympia/client/game/${session.join_code}`} />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-widest text-slate-200">OLYMPIA</p>
          <h1 className="text-2xl font-semibold">Xác thực thí sinh</h1>
          <p className="text-sm text-slate-200">
            Mã phòng: <span className="font-mono font-semibold text-white">{session.join_code}</span>
          </p>
        </div>

        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="joinCode" value={session.join_code} />

          <div className="space-y-2">
            <label htmlFor="playerPassword" className="block text-sm font-medium text-slate-100">
              Mật khẩu thí sinh
            </label>
            <div className="relative">
              <Input
                id="playerPassword"
                name="playerPassword"
                placeholder="••••••••"
                type={showPassword ? 'text' : 'password'}
                className="pr-10 bg-slate-900/70 border-slate-600 text-white placeholder:text-slate-300"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-200 hover:text-white"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={!password}>
            Vào game
          </Button>

          {state.error ? (
            <div className="space-y-3">
              <p className="text-sm text-red-200 text-center">{state.error}</p>
              {state.error.includes('đăng nhập') && (
                <div className="text-center">
                  <Link href={`/login?redirect=/olympia/client/game/${session.join_code}`} className="text-sm text-cyan-400 hover:text-cyan-300 underline">
                    Đăng nhập ngay
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-200 text-center">Nhập mật khẩu do ban tổ chức cung cấp</p>
          )}
        </form>
      </div>
    </div>
  )
}
