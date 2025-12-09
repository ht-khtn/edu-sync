import ViolationStatsPageContent from '@/components/admin/violation-stats/Page'
import RecordsRealtimeListener from '@/components/admin/violation/RecordsRealtimeListener'

// ISR: Revalidate every 60s. Stats data updates regularly but doesn't need real-time.
export const revalidate = 60

export default function ViolationStatsPage() {
  return (
    <>
      <RecordsRealtimeListener />
      <ViolationStatsPageContent />
    </>
  )
}
