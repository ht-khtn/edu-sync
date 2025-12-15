import type { Criteria, Student } from '@/lib/violations'
import ViolationFormClient from './ViolationFormClient'

type Props = {
  students: Student[]
  criteria: Criteria[]
  allowedClasses: { id: string; name: string }[]
  currentClass?: { id: string; name: string } | null
}

export function ViolationForm({ students, criteria, allowedClasses, currentClass }: Props) {
  // Students are already pre-filtered and populated by ViolationEntryPageContent
  // No additional filtering needed here
  return (
    <section className="flex flex-col gap-6">
      <ViolationFormClient
        students={students}
        criteria={criteria}
        allowedClasses={allowedClasses}
        currentClass={currentClass}
      />
    </section>
  )
}

export default ViolationForm
