'use client'

import { useActionState, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateTournamentAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

type EditTournamentDialogProps = {
  tournamentId: string
  currentName: string
  currentStatus?: string | null
  currentStartsAt?: string | null
  currentEndsAt?: string | null
}

export function EditTournamentDialog({ 
  tournamentId, 
  currentName, 
  currentStatus,
  currentStartsAt,
  currentEndsAt
}: EditTournamentDialogProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(updateTournamentAction, initialState)

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
        <Button variant="ghost" size="sm">
          Chỉnh sửa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa giải Olympia</DialogTitle>
          <DialogDescription>Cập nhật thông tin giải đấu.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="tournamentId" value={tournamentId} />

          <div className="space-y-2">
            <Label htmlFor="name">Tên giải</Label>
            <Input 
              id="name" 
              name="name" 
              defaultValue={currentName}
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startsAt">Ngày bắt đầu</Label>
            <Input 
              id="startsAt" 
              name="startsAt" 
              type="datetime-local"
              defaultValue={currentStartsAt ? new Date(currentStartsAt).toISOString().slice(0, 16) : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endsAt">Ngày kết thúc</Label>
            <Input 
              id="endsAt" 
              name="endsAt" 
              type="datetime-local"
              defaultValue={currentEndsAt ? new Date(currentEndsAt).toISOString().slice(0, 16) : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <select 
              id="status" 
              name="status" 
              className="w-full rounded-md border px-3 py-2 text-sm"
              defaultValue={currentStatus ?? 'planned'}
            >
              <option value="planned">Lên lịch</option>
              <option value="active">Đang diễn ra</option>
              <option value="archived">Đã lưu trữ</option>
            </select>
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
