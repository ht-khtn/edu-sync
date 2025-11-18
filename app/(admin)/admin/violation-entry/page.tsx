import { ViolationEntryPageContent } from '@/components/violation-entry/ViolationEntryComponents'
import QueryToasts from '@/components/common/QueryToasts'
import RecordsRealtimeListener from '@/components/violation/RecordsRealtimeListener'

export const dynamic = 'force-dynamic'

export default async function ViolationEntryPage({ 
  searchParams 
}: { 
  searchParams?: { ok?: string, error?: string } 
}) {
  return (
    <>
      <ViolationEntryPageContent searchParams={searchParams} />
      <QueryToasts ok={searchParams?.ok} error={searchParams?.error} />
      <RecordsRealtimeListener />
    </>
  )
}
