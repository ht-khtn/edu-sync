import ViolationStatsPageContent from '@/components/admin/violation-stats/Page'
import RecordsRealtimeListener from '@/components/admin/violation/RecordsRealtimeListener'

export default function ViolationStatsPage() {
  return (
    <>
      <RecordsRealtimeListener />
      <ViolationStatsPageContent />
    </>
  )
}
