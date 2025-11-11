"use client"
import { useState } from 'react'
import type { Criteria, Student } from '@/lib/violations'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

type Props = {
  students: Student[]
  criteria: Criteria[]
  allowedClasses?: { id: string; name: string }[]
}

export default function SelectFields({ students, criteria, allowedClasses }: Props) {
  const [selectedStudent, setSelectedStudent] = useState("")
  const [selectedCriteria, setSelectedCriteria] = useState("")
  const [isClassMode, setIsClassMode] = useState(false)
  const [selectedClass, setSelectedClass] = useState("")

  return (
    <>
      <section>
        <Label className="mb-2">Ghi nhận cho lớp (bật nếu muốn)</Label>
        <div className="flex items-center gap-3 mb-2">
          <input id="class-mode" type="checkbox" checked={isClassMode} onChange={(e) => {
            const val = e.target.checked
            setIsClassMode(val)
            if (val) setSelectedStudent("")
          }} />
          <label htmlFor="class-mode" className="text-sm">Ghi nhận cho lớp</label>
        </div>

        <input type="hidden" name="student_id" value={isClassMode ? "" : selectedStudent} />
        <input type="hidden" name="class_id" value={isClassMode ? selectedClass : ""} />

        <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={isClassMode}>
          <SelectTrigger data-student-trigger>
            <SelectValue placeholder="-- Chọn học sinh --" />
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.student_code} - {s.full_name} {s.class_name ? `(${s.class_name})` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isClassMode && (
          <div className="mt-3">
            <Label className="mb-2">Chọn lớp</Label>
            {/* If allowedClasses prop is available, render a select. Otherwise fallback to input. */}
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger data-class-trigger>
                <SelectValue placeholder="-- Chọn lớp --" />
              </SelectTrigger>
              <SelectContent>
                {(allowedClasses || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      <section>
        <Label className="mb-2">Loại lỗi</Label>
        <input type="hidden" name="criteria_id" value={selectedCriteria} />
        <Select value={selectedCriteria} onValueChange={setSelectedCriteria}>
          <SelectTrigger data-criteria-trigger>
            <SelectValue placeholder="-- Chọn loại lỗi --" />
          </SelectTrigger>
          <SelectContent>
            {(isClassMode ? criteria.filter((c) => c.category === 'class') : criteria).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.code} - {c.name} ({c.points})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>
    </>
  )
}
