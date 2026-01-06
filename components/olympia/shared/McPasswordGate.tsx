'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/utils/cn'

type ActionState = { error: string | null; success: string | null }

const initialState: ActionState = { error: null, success: null }

type McPasswordGateProps = {
  joinCode: string
  children?: ReactNode
  mode?: 'inline' | 'page'
}

export function McPasswordGate({ joinCode, children, mode = 'inline' }: McPasswordGateProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mcPassword, setMcPassword] = useState('')
  const [state, setState] = useState<ActionState>(initialState)
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

  const content = (
    <Card className={cn(mode === 'page' ? 'border-slate-200 bg-white' : undefined)}>
      <CardHeader>
        <CardTitle className="text-base">Chế độ MC</CardTitle>
        <CardDescription>Nhập mật khẩu MC để mở màn hình điều khiển.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (loading) return
            setLoading(true)
            setState(initialState)
            try {
              const resp = await fetch('/api/olympia/verify-mc-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ joinCode, mcPassword }),
              })

              const data: unknown = await resp.json().catch(() => null)
              const parsed = data as
                | { ok: true; message: string }
                | { ok: false; error: string }
                | null

              if (!parsed) {
                setState({ error: 'Không thể xác thực mật khẩu MC.', success: null })
                return
              }

              if ('ok' in parsed && parsed.ok) {
                setState({ error: null, success: parsed.message })
                setUnlocked(true)
                return
              }

              setState({ error: 'error' in parsed ? parsed.error : 'Sai mật khẩu MC.', success: null })
            } catch (err) {
              setState({ error: err instanceof Error ? err.message : 'Không thể xác thực mật khẩu MC.', success: null })
            } finally {
              setLoading(false)
            }
          }}
        >
          <div>
            <label htmlFor="mcPassword" className="block text-sm font-medium mb-2">
              Mật khẩu MC
            </label>
            <Input
              id="mcPassword"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="off"
              value={mcPassword}
              onChange={(e) => setMcPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            Xác thực
          </Button>
          {hasMessage ? (
            <div className={cn('rounded-md p-3 text-sm', state.error ? 'bg-destructive/10 text-destructive' : 'bg-green-50 text-green-700')}>
              {state.error ?? state.success}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Mật khẩu MC do ban tổ chức cung cấp (khác với mật khẩu thí sinh).
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )

  if (mode === 'page') {
    return <div className="mx-auto max-w-md px-4 py-10">{content}</div>
  }

  return content
}
