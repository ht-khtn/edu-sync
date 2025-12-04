import type { Criteria, Student } from '@/lib/violations'
import { filterStudentsByClass } from '@/lib/violations'
import ViolationFormClient from './ViolationFormClient'

type Props = {
  students: Student[]
  criteria: Criteria[]
  allowedClasses: { id: string; name: string }[]
  currentClass?: { id: string; name: string } | null
}

export function ViolationForm({ students, criteria, allowedClasses, currentClass }: Props) {
  // For now, we don't have server-side auth context; limit-by-class not applied here
  const effectiveStudents = filterStudentsByClass(students, [])

  return (
    <section className="flex flex-col gap-6">
      <ViolationFormClient
        students={effectiveStudents}
        criteria={criteria}
        allowedClasses={allowedClasses}
        currentClass={currentClass}
      />
    </section>
  )
}

export default ViolationForm
