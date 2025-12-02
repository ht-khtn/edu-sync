'use client'

import { useEffect, useState } from 'react'
import { useFormState } from 'react-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createMatchAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

type TournamentOption = { id: string; name: string }

type Props = {
  tournaments: TournamentOption[]
}

export function CreateMatchDialog({ tournaments }: Props) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useFormState(createMatchAction, initialState)

  useEffect(() => {
    if (state.success) {
      setOpen(false)
    }
  }, [state.success])

  const hasMessage = state.error || state.success

  return (
    <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
      <DialogTrigger asChild>
        <Button size="sm">Tạo trận mới</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo trận Olympia</DialogTitle>
          <DialogDescription>Nhập thông tin cơ bản, sau đó bạn có thể bổ sung người chơi và vòng thi.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên trận</Label>
            <Input id="name" name="name" placeholder="VD: Tuần 05 - Bảng A" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tournamentId">Thuộc giải</Label>
            <select id="tournamentId" name="tournamentId" className="w-full rounded-md border px-3 py-2 text-sm">
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
            <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
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
            <Button type="submit">Lưu trận</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
