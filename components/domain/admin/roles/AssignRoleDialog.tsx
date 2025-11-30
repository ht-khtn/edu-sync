"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { assignRoleAction } from '@/app/(admin)/admin/actions'
import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Đang cập nhật...' : 'Gán vai trò'}
    </Button>
  )
}

export function AssignRoleDialog({
  users,
  roles,
}: {
  users: Array<{ id: string; label: string }>
  roles: Array<{ id: string; name: string }>
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Gán vai trò</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gán vai trò / cập nhật quyền</DialogTitle>
        </DialogHeader>
        <form action={assignRoleAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-user">Tài khoản</Label>
            <select
              id="role-user"
              name="userId"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                -- Chọn người dùng --
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-id">Vai trò</Label>
            <select
              id="role-id"
              name="roleId"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                -- Chọn vai trò --
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.id} {role.name ? `- ${role.name}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-target">Target (tuỳ chọn)</Label>
            <Input id="role-target" name="target" placeholder="VD: 12A1 hoặc ALL" />
          </div>
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
