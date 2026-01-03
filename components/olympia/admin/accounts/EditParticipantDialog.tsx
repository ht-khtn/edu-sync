'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Edit } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateParticipantAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const initialState: ActionState = { error: null, success: null }

type EditParticipantDialogProps = {
  userId: string
  currentContestantCode: string | null
  currentRole: string | null
  userName?: string | null
  userClassName?: string | null
}

function EditParticipantForm({
  userId,
  currentContestantCode,
  currentRole,
  userName,
  userClassName,
  onDone,
}: EditParticipantDialogProps & { onDone: () => void }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateParticipantAction, initialState)
  const lastToastRef = useRef<string | null>(null)

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
    onDone()
  }, [onDone, router, state.error, state.success])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />

      <div className="space-y-2">
        <Label>User ID</Label>
        <p className="text-sm font-mono text-muted-foreground">{userId}</p>
      </div>

      {userName ? (
        <div className="space-y-2">
          <Label>Tên</Label>
          <p className="text-sm">{userName}</p>
        </div>
      ) : null}

      {userClassName ? (
        <div className="space-y-2">
          <Label>Lớp</Label>
          <p className="text-sm">{userClassName}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="role">Vai trò</Label>
        <select
          id="role"
          name="role"
          className="w-full rounded-md border px-3 py-2 text-sm"
          defaultValue={currentRole ?? 'contestant'}
        >
          <option value="contestant">Thí sinh</option>
          <option value="AD">Admin</option>
          <option value="MOD">Mod</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contestantCode">Mã thí sinh (tùy chọn)</Label>
        <Input
          id="contestantCode"
          name="contestantCode"
          placeholder="VD: THI001, A-001"
          defaultValue={currentContestantCode ?? ''}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Hủy
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang cập nhật…' : 'Cập nhật'}
        </Button>
      </div>
    </form>
  )
}

export function EditParticipantDialog({ userId, currentContestantCode, currentRole, userName, userClassName }: EditParticipantDialogProps) {
  const [open, setOpen] = useState(false)
  const [nonce, setNonce] = useState(0)

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (!value) setNonce((n) => n + 1)
  }

  const handleDone = () => {
    setOpen(false)
    setNonce((n) => n + 1)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Chỉnh sửa">
          <Edit className="h-4 w-4" />
          <span className="sr-only">Chỉnh sửa</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tài khoản Olympia</DialogTitle>
          <DialogDescription>Cập nhật vai trò và mã thí sinh.</DialogDescription>
        </DialogHeader>
        <EditParticipantForm
          key={nonce}
          userId={userId}
          currentContestantCode={currentContestantCode}
          currentRole={currentRole}
          userName={userName}
          userClassName={userClassName}
          onDone={handleDone}
        />
      </DialogContent>
    </Dialog>
  )
}
