"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createClassAction } from '@/app/(admin)/admin/actions'
import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Đang tạo...' : 'Tạo lớp'}
    </Button>
  )
}

export function CreateClassDialog({
  grades,
  teachers,
}: {
  grades: Array<{ id: string; name: string }>
  teachers: Array<{ id: string; label: string }>
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Tạo lớp</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm lớp học mới</DialogTitle>
        </DialogHeader>
        <form action={createClassAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="class-name">Tên lớp</Label>
            <Input id="class-name" name="className" required placeholder="VD: 12A3" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-grade">Khối</Label>
            <select
              id="class-grade"
              name="gradeId"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                -- Chọn khối --
              </option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-homeroom">Giáo viên CN (tuỳ chọn)</Label>
            <select
              id="class-homeroom"
              name="homeroomTeacherId"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">-- Chưa gán --</option>
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
