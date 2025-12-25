'use client'

import { useActionState, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateMatchAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

type TournamentOption = { id: string; name: string }

type EditMatchDialogProps = {
  matchId: string
  currentName: string
  currentTournamentId?: string | null
  currentStatus: string
  currentScheduledAt?: string | null
  tournaments: TournamentOption[]
}

export function EditMatchDialog({ 
  matchId, 
  currentName,
  currentTournamentId,
  currentStatus,
  currentScheduledAt,
  tournaments
}: EditMatchDialogProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(updateMatchAction, initialState)

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
          <DialogTitle>Chỉnh sửa trận Olympia</DialogTitle>
          <DialogDescription>Cập nhật thông tin trận đấu.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="matchId" value={matchId} />

          <div className="space-y-2">
            <Label htmlFor="name">Tên trận</Label>
            <Input 
              id="name" 
              name="name" 
              defaultValue={currentName}
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tournamentId">Thuộc giải</Label>
            <select 
              id="tournamentId" 
              name="tournamentId" 
              className="w-full rounded-md border px-3 py-2 text-sm"
              defaultValue={currentTournamentId ?? ''}
            >
              <option value="">-- Chưa gán --</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Thời gian dự kiến</Label>
            <Input 
              id="scheduledAt" 
              name="scheduledAt" 
              type="datetime-local"
              defaultValue={currentScheduledAt ? new Date(currentScheduledAt).toISOString().slice(0, 16) : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <select 
              id="status" 
              name="status" 
              className="w-full rounded-md border px-3 py-2 text-sm"
              defaultValue={currentStatus ?? 'draft'}
            >
              <option value="draft">Nháp</option>
              <option value="scheduled">Đã lên lịch</option>
              <option value="live">Đang diễn ra</option>
              <option value="finished">Đã kết thúc</option>
              <option value="cancelled">Đã hủy</option>
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
