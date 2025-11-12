"use client"

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'

type Option = { id: string; name: string }

export default function Filters({
  initial,
  classes,
  students,
  criteria,
}: {
  initial: { classId: string; studentId: string; criteriaId: string; start: string; end: string }
  classes: Option[]
  students: Option[]
  criteria: Option[]
}) {
  const router = useRouter()
  const [classId, setClassId] = useState(initial.classId)
  const [studentId, setStudentId] = useState(initial.studentId)
  const [criteriaId, setCriteriaId] = useState(initial.criteriaId)
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)

  function apply() {
    const params = new URLSearchParams()
    if (classId) params.set('classId', classId)
    if (studentId) params.set('studentId', studentId)
    if (criteriaId) params.set('criteriaId', criteriaId)
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    const q = params.toString()
    router.push(q ? `/violation-history?${q}` : '/violation-history')
  }

  function clearAll() {
    setClassId('')
    setStudentId('')
    setCriteriaId('')
    setStart('')
    setEnd('')
    router.push('/violation-history')
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Lớp</Label>
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger>
            <SelectValue placeholder="-- Tất cả --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">-- Tất cả --</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Học sinh</Label>
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger>
            <SelectValue placeholder="-- Tất cả --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">-- Tất cả --</SelectItem>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Tiêu chí</Label>
        <Select value={criteriaId} onValueChange={setCriteriaId}>
          <SelectTrigger>
            <SelectValue placeholder="-- Tất cả --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">-- Tất cả --</SelectItem>
            {criteria.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Từ ngày</Label>
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Đến ngày</Label>
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>

      <div className="flex items-end gap-2">
        <Button onClick={apply} className="h-[34px]">Lọc</Button>
        <Button variant="secondary" onClick={clearAll} className="h-[34px]">Xoá lọc</Button>
      </div>
    </div>
  )
}
