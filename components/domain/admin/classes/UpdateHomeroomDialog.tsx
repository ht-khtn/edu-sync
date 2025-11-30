"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { updateHomeroomAction } from '@/app/(admin)/admin/actions'
import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Đang cập nhật...' : 'Cập nhật GVCN'}
    </Button>
  )
}

export function UpdateHomeroomDialog({
  classes,
  teachers,
}: {
  classes: Array<{ id: string; name: string }>
  teachers: Array<{ id: string; label: string }>
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Phân công GVCN</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Phân công / cập nhật giáo viên chủ nhiệm</DialogTitle>
        </DialogHeader>
        <form action={updateHomeroomAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="homeroom-class">Lớp</Label>
            <select
              id="homeroom-class"
              name="classId"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                -- Chọn lớp --
              </option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="homeroom-teacher">Giáo viên</Label>
            <select
              id="homeroom-teacher"
              name="homeroomTeacherId"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">-- Bỏ gán --</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.label}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
