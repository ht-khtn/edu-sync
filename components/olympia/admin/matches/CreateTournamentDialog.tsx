'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTournamentAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const initialState: ActionState = { error: null, success: null }

export function CreateTournamentDialog() {
  const [open, setOpen] = useState(false)
  const [nonce, setNonce] = useState(0)
  const router = useRouter()
  const [state, formAction, pending] = useActionState(createTournamentAction, initialState)
  const lastToastRef = useRef<string | null>(null)

  useEffect(() => {
    const message = state.error ?? state.success
    if (!message) return
    if (lastToastRef.current === message) return
    lastToastRef.current = message

    if (state.error) toast.error(message)
    if (state.success) {
      toast.success(message)
      setOpen(false)
      router.refresh()
    }
  }, [router, state.error, state.success])

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (!value) {
      setNonce((v) => v + 1)
      lastToastRef.current = null
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
        <form key={nonce} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên giải</Label>
            <Input
              id="name"
              name="name"
              placeholder="VD: Olympia Quý 1 - 2025"
              required
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startsAt">Ngày bắt đầu</Label>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endsAt">Ngày kết thúc</Label>
            <Input
              id="endsAt"
              name="endsAt"
              type="datetime-local"
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <select
              id="status"
              name="status"
              className="w-full rounded-md border px-3 py-2 text-sm"
              defaultValue="planned"
              disabled={pending}
            >
              <option value="planned">Lên lịch</option>
              <option value="active">Đang diễn ra</option>
              <option value="archived">Đã lưu trữ</option>
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Đang tạo…' : 'Tạo giải'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
