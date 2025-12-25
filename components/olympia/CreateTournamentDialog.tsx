'use client'

import { useActionState, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTournamentAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

export function CreateTournamentDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(createTournamentAction, initialState)

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
        <Button size="sm">Tạo giải mới</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo giải Olympia</DialogTitle>
          <DialogDescription>Nhập thông tin cơ bản giải đấu.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên giải</Label>
            <Input 
              id="name" 
              name="name" 
              placeholder="VD: Olympia Quý 1 - 2025"
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startsAt">Ngày bắt đầu</Label>
            <Input 
              id="startsAt" 
              name="startsAt" 
              type="datetime-local"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endsAt">Ngày kết thúc</Label>
            <Input 
              id="endsAt" 
              name="endsAt" 
              type="datetime-local"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <select 
              id="status" 
              name="status" 
              className="w-full rounded-md border px-3 py-2 text-sm"
              defaultValue="planned"
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
            <Button type="submit">Tạo giải</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
