'use client'

import { useActionState, useState } from 'react'
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

const initialState: ActionState = { error: null, success: null }

type DeleteParticipantButtonProps = {
  userId: string
}

export function DeleteParticipantButton({ userId }: DeleteParticipantButtonProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(deleteParticipantAction, initialState)

  const handleOpenChange = (value: boolean) => {
    if (state.success) {
      setOpen(false)
    } else {
      setOpen(value)
    }
  }

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
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />

          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : state.success ? (
            <p className="text-sm text-green-600">{state.success}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="destructive">
              Xóa tài khoản
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
