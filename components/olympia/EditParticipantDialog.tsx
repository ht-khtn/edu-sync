'use client'

import { useActionState, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Edit } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateParticipantAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

type EditParticipantDialogProps = {
  userId: string
  currentContestantCode: string | null
  currentRole: string | null
}

export function EditParticipantDialog({ userId, currentContestantCode, currentRole }: EditParticipantDialogProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(updateParticipantAction, initialState)

  const hasMessage = state.error || state.success

  const handleOpenChange = (value: boolean) => {
    if (hasMessage && state.success) {
      setOpen(false)
    } else {
      setOpen(value)
    }
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
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />

          <div className="space-y-2">
            <Label>User ID</Label>
            <p className="text-sm font-mono text-muted-foreground">{userId}</p>
          </div>

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

          {hasMessage ? (
            <p className={cn('text-sm', state.error ? 'text-destructive' : 'text-green-600')}>
              {state.error ?? state.success}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit">Cập nhật</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
