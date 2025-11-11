"use client"
import { useState } from 'react'
import type { Criteria, Student } from '@/lib/violations'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

type Props = {
  students: Student[]
  criteria: Criteria[]
  allowedClasses?: { id: string; name: string }[]
  currentClass?: { id: string; name: string } | null
  showCurrentClass?: boolean
}

export default function SelectFields({ students, criteria, allowedClasses, currentClass }: Props) {
  const [selectedStudent, setSelectedStudent] = useState("")
  const [selectedCriteria, setSelectedCriteria] = useState("")
  const [isClassMode, setIsClassMode] = useState(false)

  return (
    <>

      <section>
        <Label className="mb-2">Đối tượng ghi nhận</Label>
        <div className="flex items-center gap-3 mb-3">
          <input id="class-mode" type="checkbox" checked={isClassMode} onChange={(e) => {
            const val = e.target.checked
            setIsClassMode(val)
            if (val) setSelectedStudent("")
          }} />
          <label htmlFor="class-mode" className="text-sm">Ghi nhận cho lớp</label>
        </div>

        <input type="hidden" name="student_id" value={isClassMode ? "" : selectedStudent} />
        <input type="hidden" name="class_id" value={isClassMode && currentClass ? currentClass.id : ""} />

        <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={isClassMode}>
          <SelectTrigger data-student-trigger>
            <SelectValue placeholder="-- Chọn học sinh --" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-white">
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.full_name} {s.class_name ? `(${s.class_name})` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section>
        <Label className="mb-2">Loại lỗi</Label>
        <input type="hidden" name="criteria_id" value={selectedCriteria} />
        <Select value={selectedCriteria} onValueChange={setSelectedCriteria}>
          <SelectTrigger data-criteria-trigger>
            <SelectValue placeholder="-- Chọn loại lỗi --" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-white">
            {(isClassMode
              ? criteria.filter((c) => c.category === 'class')
              : criteria.filter((c) => c.category === 'student')
            ).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.points})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>
    </>
  )
}
