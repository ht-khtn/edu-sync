"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createAccountAction } from '@/app/(admin)/admin/actions'
import { useFormStatus } from 'react-dom'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Đang xử lý...' : label}
    </Button>
  )
}

export function CreateAccountDialog({
  classes,
}: {
  classes: Array<{ id: string; name: string }>
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Tạo tài khoản</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo tài khoản mới</DialogTitle>
        </DialogHeader>
        <form action={createAccountAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" name="email" type="email" required placeholder="abc@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-username">Tên đăng nhập</Label>
            <Input id="account-username" name="username" placeholder="Nếu bỏ trống sẽ lấy theo email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-fullname">Họ tên</Label>
            <Input id="account-fullname" name="fullName" placeholder="Tuỳ chọn" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-class">Lớp</Label>
            <select
              id="account-class"
              name="classId"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">-- Không gán --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <SubmitButton label="Tạo tài khoản" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
