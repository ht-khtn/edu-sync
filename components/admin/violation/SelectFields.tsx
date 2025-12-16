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
    currentClass?.id ?? (allowedClasses && allowedClasses.length > 1 ? '' : allowedClasses?.[0]?.id ?? '')
  )
  const canRecordForClass = Boolean(currentClass || allowedClasses?.length)
  const fallbackClassId = selectedClassId || allowedClasses?.[0]?.id || ''
  const classIdForSubmit = currentClass?.id ?? fallbackClassId

  // Effective class id used for filtering displayed students
  const classIdForFilter = (currentClass?.id ?? selectedClassId) || ''

  // When selected class changes, clear selected student to avoid stale IDs
  function handleClassChange(val: string) {
    setSelectedClassId(val)
    setSelectedStudent('')
  }

  console.log('[SelectFields] allowedClasses:', allowedClasses?.length || 0, 'currentClass:', currentClass?.name, 'canRecordForClass:', canRecordForClass)

  return (
    <>
      <section>
        <Label className="mb-2">Chọn lớp</Label>
        {!currentClass && allowedClasses && allowedClasses.length > 0 ? (
          <Select value={selectedClassId} onValueChange={handleClassChange}>
            <SelectTrigger data-class-trigger>
              <SelectValue placeholder="-- Chọn lớp --" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-white">
              {allowedClasses.length > 1 && (
                <SelectItem value="">
                  Tất cả lớp
                </SelectItem>
              )}
              {allowedClasses.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : currentClass ? (
          <div className="px-3 py-2 border rounded-md bg-muted">
            <span className="font-medium">{currentClass.name}</span>
            <span className="text-sm text-muted-foreground ml-2">(Lớp mặc định)</span>
          </div>
        ) : (
          <div className="px-3 py-2 border rounded-md bg-muted text-sm text-muted-foreground">
            Không có lớp nào để chọn
          </div>
        )}
      </section>

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
            {/* Filter students by currently selected class (or show all when none selected) */}
            {students.filter((s) => {
              if (!classIdForFilter) return true
              return s.class_id === classIdForFilter
            }).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name && s.full_name !== 'Chưa cập nhật' ? s.full_name : s.user_name}
              </SelectItem>
            ))}
            {students.filter((s) => (classIdForFilter ? s.class_id === classIdForFilter : true)).length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">Không có học sinh cho lớp này</div>
            )}
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
              ? criteria.filter((c) => c.isActive && c.category === 'class')
              : criteria.filter((c) => c.isActive && c.category === 'student')
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
