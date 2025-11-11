import { ViolationEntryPageContent } from '@/components/violation-entry/ViolationEntryComponents'
import QueryToasts from '@/components/common/QueryToasts'
export const dynamic = 'force-dynamic'

export default function ViolationEntryPage({ searchParams }: { searchParams?: { ok?: string, error?: string } }) {
  return (
    <>
      <ViolationEntryPageContent searchParams={searchParams} />
      <QueryToasts ok={searchParams?.ok} error={searchParams?.error} />
    </>
  )
}
