"use client"

import type { Criteria, Student } from '@/lib/violations'
import SelectFields from '@/components/violation/SelectFields'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useFormStatus } from 'react-dom'

type Props = {
  students: Student[]
  criteria: Criteria[]
  allowedClasses: { id: string; name: string }[]
  currentClass?: { id: string; name: string } | null
  action: (formData: FormData) => void | Promise<void>
}

function PendingButtons() {
  const { pending } = useFormStatus()
  return (
    <section className="lg:col-span-2 flex gap-3 items-center">
      <Button type="submit" disabled={pending} className="shadow-md border-2 border-primary">{pending ? 'Đang ghi...' : 'Ghi nhận'}</Button>
      <Button type="reset" variant="outline" disabled={pending}>Làm mới</Button>
    </section>
  )
}

export default function ViolationFormClient({ students, criteria, allowedClasses, currentClass, action }: Props) {
  function handleBeforeSubmit(form: HTMLFormElement) {
    const studentId = (form.querySelector('input[name="student_id"]') as HTMLInputElement)?.value
    const classId = (form.querySelector('input[name="class_id"]') as HTMLInputElement)?.value
    const criteriaId = (form.querySelector('input[name="criteria_id"]') as HTMLInputElement)?.value
    if (!studentId && !classId) {
      toast.error('Chọn học sinh hoặc chọn ghi nhận cho lớp.')
      const trg = form.querySelector('[data-student-trigger], [data-class-trigger]') as HTMLElement | null
      trg?.focus()
      return false
    }
    if (!criteriaId) {
      toast.error('Chọn loại lỗi trước khi ghi nhận.')
      const trg = form.querySelector('[data-criteria-trigger]') as HTMLElement | null
      trg?.focus()
      return false
    }
    return true
  }

  return (
    <form
      action={async (fd: FormData) => {
        const formEl = (document?.activeElement?.closest('form') as HTMLFormElement) || (document.querySelector('form[action]') as HTMLFormElement | null)
        if (formEl && !handleBeforeSubmit(formEl)) return
        await action(fd)
      }}
      className="grid gap-6 lg:grid-cols-2"
    >
  <SelectFields students={students} criteria={criteria} allowedClasses={allowedClasses} currentClass={currentClass} />

      <section className="lg:col-span-1">
        <Label className="mb-2">Lý do / ghi chú</Label>
        <Input type="text" name="reason" placeholder="Tuỳ chọn" />
      </section>

      <section className="lg:col-span-2">
        <Label className="mb-2">Link minh chứng (tuỳ chọn)</Label>
        <Input type="url" name="evidence_url" placeholder="https://..." />
      </section>

      <PendingButtons />
    </form>
  )
}
