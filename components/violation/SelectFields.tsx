"use client"
import { useState } from 'react'
import type { Criteria, Student } from '@/lib/violations'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

type Props = {
  students: Student[]
  criteria: Criteria[]
}

export default function SelectFields({ students, criteria }: Props) {
  const [selectedStudent, setSelectedStudent] = useState("")
  const [selectedCriteria, setSelectedCriteria] = useState("")

  return (
    <>
      <section>
        <Label className="mb-2">Học sinh</Label>
        <input type="hidden" name="student_id" value={selectedStudent} />
        <Select value={selectedStudent} onValueChange={setSelectedStudent}>
          <SelectTrigger>
            <SelectValue placeholder="-- Chọn học sinh --" />
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.student_code} - {s.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section>
        <Label className="mb-2">Loại lỗi</Label>
        <input type="hidden" name="criteria_id" value={selectedCriteria} />
        <Select value={selectedCriteria} onValueChange={setSelectedCriteria}>
          <SelectTrigger>
            <SelectValue placeholder="-- Chọn loại lỗi --" />
          </SelectTrigger>
          <SelectContent>
            {criteria.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.code} - {c.name} ({c.points})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>
    </>
  )
}
