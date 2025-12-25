'use client'

import { useActionState, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createParticipantAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

export function CreateParticipantDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(createParticipantAction, initialState)

  const hasMessage = state.error || state.success

  // Close dialog on success
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
        <Button size="sm">Thêm tài khoản</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm tài khoản Olympia</DialogTitle>
          <DialogDescription>Nhập thông tin để tạo tài khoản thí sinh hoặc admin mới.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userId">User ID (UUID)</Label>
            <Input 
              id="userId" 
              name="userId" 
              placeholder="Sao chép từ danh sách users"
              required 
            />
            <p className="text-xs text-muted-foreground">
              ID từ bảng auth.users hoặc users
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Vai trò</Label>
            <select 
              id="role" 
              name="role" 
              className="w-full rounded-md border px-3 py-2 text-sm"
              defaultValue="contestant"
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
            />
            <p className="text-xs text-muted-foreground">
              Để trống nếu không phải thí sinh
            </p>
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
            <Button type="submit">Tạo tài khoản</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
