import { ViolationHistoryPageContent } from '@/components/violation-history/ViolationHistoryComponents'
import RecordsRealtimeListener from '@/components/violation/RecordsRealtimeListener'

export const dynamic = 'force-dynamic'

export default function ViolationHistoryPage({ searchParams }: { searchParams?: any }) {
  return (
    <>
      <ViolationHistoryPageContent searchParams={searchParams} />
      <RecordsRealtimeListener />
    </>
  )
}
