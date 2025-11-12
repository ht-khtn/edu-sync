import { MyViolationsPageContent } from '@/components/my-violations/MyViolationsComponents'
import RecordsRealtimeListener from '@/components/violation/RecordsRealtimeListener'

export const dynamic = 'force-dynamic'

// Page: Personal violations (student / YUM roles)
// Shows only records where the current user is the student.
// Role gate: user must have role_id in ('S','YUM'). If missing redirect home.
export default function MyViolationsPage() {
  return (
    <>
      <MyViolationsPageContent />
      <RecordsRealtimeListener />
    </>
  )
}
