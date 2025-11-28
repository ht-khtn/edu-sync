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
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedCriteria, setSelectedCriteria] = useState('')
  const [isClassMode, setIsClassMode] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState(
    currentClass?.id ?? allowedClasses?.[0]?.id ?? ''
  )
  const canRecordForClass = Boolean(currentClass || allowedClasses?.length)
  const fallbackClassId = selectedClassId || allowedClasses?.[0]?.id || ''
  const classIdForSubmit = currentClass?.id ?? fallbackClassId

  return (
    <>

      <section>
        <Label className="mb-2">Đối tượng ghi nhận</Label>
        <div className="flex items-center gap-3 mb-3">
          <input
            id="class-mode"
            type="checkbox"
            checked={isClassMode}
            disabled={!canRecordForClass}
            onChange={(e) => {
              if (!canRecordForClass) return
              const val = e.target.checked
              setIsClassMode(val)
              if (val) setSelectedStudent('')
            }}
          />
          <label htmlFor="class-mode" className="text-sm">
            Ghi nhận cho lớp
            {!canRecordForClass ? ' (chưa có quyền)' : ''}
          </label>
        </div>

        <input type="hidden" name="student_id" value={isClassMode ? '' : selectedStudent} />
        <input
          type="hidden"
          name="class_id"
          value={isClassMode ? classIdForSubmit : ''}
        />

        <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={isClassMode}>
          <SelectTrigger data-student-trigger>
            <SelectValue placeholder="-- Chọn học sinh --" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-white">
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name && s.full_name !== 'Chưa cập nhật' ? s.full_name : s.user_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isClassMode && !currentClass && allowedClasses?.length ? (
          <div className="mt-4">
            <Label className="mb-2">Chọn lớp được cấp quyền</Label>
            <Select value={fallbackClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger data-class-trigger>
                <SelectValue placeholder="-- Chọn lớp --" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-white">
                {allowedClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
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
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.points})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>
    </>
  )
}
