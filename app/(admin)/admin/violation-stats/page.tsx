import ViolationStatsPageContent from '@/components/domain/violation-stats/Page'
import RecordsRealtimeListener from '@/components/domain/violation/RecordsRealtimeListener'

export const dynamic = 'force-dynamic'

export default function ViolationStatsPage() {
  return (
    <>
      <RecordsRealtimeListener />
      <ViolationStatsPageContent />
    </>
  )
}
