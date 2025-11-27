"use client"

import type { Criteria, Student } from '@/lib/violations'
import SelectFields from '@/components/violation/SelectFields'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  students: Student[]
  criteria: Criteria[]
  allowedClasses: { id: string; name: string }[]
  currentClass?: { id: string; name: string } | null
}

function PendingButtons({ pending }: { pending: boolean }) {
  return (
    <section className="lg:col-span-2 flex gap-3 items-center">
      <Button type="submit" disabled={pending} className="shadow-md border-2 border-primary">{pending ? 'Đang ghi...' : 'Ghi nhận'}</Button>
      <Button type="reset" variant="outline" disabled={pending}>Làm mới</Button>
    </section>
  )
}

export default function ViolationFormClient({ students, criteria, allowedClasses, currentClass }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

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
      onSubmit={async (e) => {
        e.preventDefault()
        const formEl = e.target as HTMLFormElement
        if (!handleBeforeSubmit(formEl)) return

        // Close modal immediately (click the dialog close button if present)
        const closeBtn = document.querySelector('[data-slot="dialog-close"]') as HTMLElement | null
        if (closeBtn) closeBtn.click()

        const fd = new FormData(formEl)
        const payload: Record<string, string | number | null> = {}
        fd.forEach((value, key) => {
          if (value instanceof File) return
          if (key === 'points') {
            const num = Number(value)
            payload[key] = Number.isNaN(num) ? null : num
          } else {
            payload[key] = value
          }
        })

        setPending(true)
        try {
          const res = await fetch('/api/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          })
          const data = await res.json()
          if (!res.ok) {
            if (res.status === 401) {
              toast.error('Bạn chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập lại.')
            } else if (res.status === 403) {
              toast.error('Bạn không có quyền ghi nhận cho lớp này.')
            } else {
              toast.error(data?.error || 'Lỗi khi ghi nhận')
            }
          } else {
            toast.success('Đã gửi ghi nhận. Danh sách sẽ được làm mới khi hoàn tất.')
          }
        } catch (err) {
          toast.error('Lỗi mạng khi gửi ghi nhận')
        } finally {
          setPending(false)
          router.refresh()
        }
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

      <PendingButtons pending={pending} />
    </form>
  )
}
