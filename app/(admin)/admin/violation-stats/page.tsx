import ViolationStatsPageContent from '@/components/violation-stats/Page'
import RecordsRealtimeListener from '@/components/violation/RecordsRealtimeListener'

export const dynamic = 'force-dynamic'

export default function ViolationStatsPage() {
  return (
    <>
      <RecordsRealtimeListener />
      <ViolationStatsPageContent />
    </>
  )
}
