import { describe, it, expect } from 'vitest'
import { filterStudentsByClass, type Student } from '@/lib/violations'

describe('filterStudentsByClass', () => {
  const students: Student[] = [
    { id: '1', student_code: 'A-001', full_name: 'A', class_id: '10A1' },
    { id: '2', student_code: 'A-002', full_name: 'B', class_id: '10A2' },
    { id: '3', student_code: 'A-003', full_name: 'C', class_id: '10A1' },
  ]

  it('returns original when no classIds', () => {
    expect(filterStudentsByClass(students, undefined).length).toBe(3)
    expect(filterStudentsByClass(students, []).length).toBe(3)
  })

  it('filters by single class', () => {
    const res = filterStudentsByClass(students, ['10A1'])
    expect(res.length).toBe(2)
    expect(res.map(s => s.id)).toEqual(['1', '3'])
  })

  it('filters by multiple classes', () => {
    const res = filterStudentsByClass(students, ['10A1', '10A2'])
    expect(res.length).toBe(3)
  })
})
