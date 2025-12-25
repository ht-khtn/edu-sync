'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getSessionPasswordAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { toast } from 'sonner'
import type { LiveSessionRow } from '@/types/olympia/game'

const initialState: ActionState = { error: null, success: null }

function PasswordDisplay({ label, value, variant = 'default' }: { label: string; value: string; variant?: 'default' | 'success' }) {
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success('Đã copy vào clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const bgColor = variant === 'success' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
  const textColor = variant === 'success' ? 'text-green-900' : 'text-slate-900'

  return (
    <div className={`rounded-lg border ${bgColor} p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <p className={`text-sm font-semibold ${textColor}`}>{label}</p>
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={showPassword ? 'Ẩn' : 'Hiện'}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <code className={`flex-1 rounded bg-white px-2 py-1.5 text-sm font-mono ${textColor}`}>
          {showPassword ? value : '••••••••'}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="gap-1"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Đã copy
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

type ViewPasswordDialogProps = {
  session: LiveSessionRow
  trigger?: React.ReactNode
}

export function ViewPasswordDialog({ session, trigger }: ViewPasswordDialogProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(getSessionPasswordAction, initialState)

  // Extract passwords from success message
  const extractPasswords = (msg?: string | null) => {
    if (!msg || !msg.includes('Mật khẩu')) return { playerPassword: null, mcPassword: null }
    const playerMatch = msg.match(/Mật khẩu thí sinh: (\S+)/)
    const mcMatch = msg.match(/Mật khẩu MC: (\S+)/)
    return {
      playerPassword: playerMatch?.[1] ?? null,
      mcPassword: mcMatch?.[1] ?? null,
    }
  }

  const { playerPassword, mcPassword } = extractPasswords(state.success)
  const hasNewPasswords = playerPassword && mcPassword

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1 w-full">
            <Eye className="h-4 w-4" />
            Xem mật khẩu
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mật khẩu phòng thi</DialogTitle>
          <DialogDescription>
            Mã tham gia: <span className="font-mono font-semibold text-slate-900">{session.join_code}</span>
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="sessionId" value={session.id} />

          {!hasNewPasswords ? (
            <Alert>
              <AlertDescription>
                Bấm &lsquo;Xem mật khẩu&rsquo; để hiển thị mật khẩu hiện tại của phòng thi.
              </AlertDescription>
            </Alert>
          ) : null}

          {hasNewPasswords ? (
            <div className="space-y-3">
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <p className="mb-3 font-semibold text-blue-900">🔐 Mật khẩu phòng thi</p>
                <div className="space-y-3">
                  <PasswordDisplay label="Mật khẩu thí sinh" value={playerPassword} variant="success" />
                  <PasswordDisplay label="Mật khẩu MC/Người dẫn" value={mcPassword} variant="success" />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setOpen(false)
                }}
              >
                Đóng
              </Button>
            </div>
          ) : (
            <>
              {state.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={isPending} className="w-full gap-2">
                <Eye className="h-4 w-4" />
                {isPending ? 'Đang tải...' : 'Xem mật khẩu'}
              </Button>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
