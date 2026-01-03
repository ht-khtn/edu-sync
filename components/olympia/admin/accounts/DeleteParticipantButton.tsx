'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { deleteParticipantAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { toast } from 'sonner'

const initialState: ActionState = { error: null, success: null }

type DeleteParticipantButtonProps = {
  userId: string
}

export function DeleteParticipantButton({ userId }: DeleteParticipantButtonProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const [nonce, setNonce] = useState(0)
  const [state, formAction, pending] = useActionState(deleteParticipantAction, initialState)
  const lastToastRef = useRef<string | null>(null)

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (!value) setNonce((n) => n + 1)
  }

  useEffect(() => {
    const message = state.error ?? state.success
    if (!message) return
    if (lastToastRef.current === message) return
    lastToastRef.current = message

    if (state.error) {
      toast.error(message)
      return
    }

    toast.success(message)
    try {
      router.refresh()
    } catch {
      // ignore
    }
    setOpen(false)
    setNonce((n) => n + 1)
  }, [router, state.error, state.success])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive">
          Xóa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xóa tài khoản Olympia</DialogTitle>
          <DialogDescription>
            Bạn có chắc muốn xóa tài khoản này? Hành động này không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4" key={nonce}>
          <input type="hidden" name="userId" value={userId} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Đang xóa…' : 'Xóa tài khoản'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
