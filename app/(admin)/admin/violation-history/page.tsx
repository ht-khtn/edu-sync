import { ViolationHistoryPageContent } from '@/components/domain/violation-history/ViolationHistoryComponents'
import RecordsRealtimeListener from '@/components/domain/violation/RecordsRealtimeListener'

export const dynamic = 'force-dynamic'

export default function ViolationHistoryPage({ 
  searchParams 
}: { 
  searchParams?: Record<string, string | string[] | undefined> 
}) {
  return (
    <>
      <ViolationHistoryPageContent searchParams={searchParams} />
      <RecordsRealtimeListener />
    </>
  )
}
