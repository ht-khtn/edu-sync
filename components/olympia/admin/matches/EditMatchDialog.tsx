'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Edit } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateMatchAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { toast } from 'sonner'

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
          <DialogTitle>Chỉnh sửa trận Olympia</DialogTitle>
          <DialogDescription>Cập nhật thông tin trận đấu.</DialogDescription>
        </DialogHeader>
        <EditMatchForm
          key={nonce}
          matchId={matchId}
          currentName={currentName}
          currentTournamentId={currentTournamentId}
          currentStatus={currentStatus}
          currentScheduledAt={currentScheduledAt}
          tournaments={tournaments}
          onDone={handleDone}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditMatchForm({
  matchId,
  currentName,
  currentTournamentId,
  currentStatus,
  currentScheduledAt,
  tournaments,
  onDone,
}: EditMatchDialogProps & { onDone: () => void }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateMatchAction, initialState)
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
      <input type="hidden" name="matchId" value={matchId} />

      <div className="space-y-2">
        <Label htmlFor="name">Tên trận</Label>
        <Input id="name" name="name" defaultValue={currentName} required />
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
        <select id="status" name="status" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={currentStatus ?? 'draft'}>
          <option value="draft">Nháp</option>
          <option value="scheduled">Đã lên lịch</option>
          <option value="live">Đang diễn ra</option>
          <option value="finished">Đã kết thúc</option>
          <option value="cancelled">Đã hủy</option>
        </select>
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
