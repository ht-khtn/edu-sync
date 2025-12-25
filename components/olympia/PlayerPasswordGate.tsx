'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { lookupJoinCodeAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { toast } from 'sonner'
import type { LiveSessionRow } from '@/types/olympia/game'

const initialState: ActionState = { error: null, success: null }

type PlayerPasswordGateProps = {
  session: LiveSessionRow
  children: React.ReactNode
}

export function PlayerPasswordGate({ session, children }: PlayerPasswordGateProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [state, formAction] = useActionState(lookupJoinCodeAction, initialState)

  // Check if session requires password
  const requiresPassword = session.requires_player_password ?? true
  const storageKey = `olympia_verified_${session.id}`

  // Initialize verified state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedVerified = localStorage.getItem(storageKey)
      if (savedVerified === 'true') {
        setIsVerified(true)
      }
    }
  }, [session.id, storageKey])

  // Handle success - allow access and save to localStorage
  useEffect(() => {
    if (state.success && state.data?.sessionId) {
      toast.success('Xác thực thành công')
      // Use requestAnimationFrame to avoid cascading renders
      const timer = requestAnimationFrame(() => {
        setIsVerified(true)
        // Save verified state to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, 'true')
        }
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
  }, [state.success, state.error, state.data, storageKey])

  // If no password required or already verified, show children
  if (!requiresPassword || isVerified) {
    return <>{children}</>
  }

  // Show password gate
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Xác thực để tham gia phòng thi</CardTitle>
          <CardDescription>
            Mã tham gia: <span className="font-mono font-semibold text-slate-900">{session.join_code}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="joinCode" value={session.join_code} />
            
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

            <Button type="submit" className="w-full" disabled={!password}>
              Xác thực
            </Button>

            {state.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                Nhập mật khẩu do ban tổ chức cung cấp
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
