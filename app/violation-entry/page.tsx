import { ViolationEntryPageContent } from '@/components/violation-entry/ViolationEntryComponents'
export const dynamic = 'force-dynamic'

export default function ViolationEntryPage({ searchParams }: { searchParams?: { ok?: string } }) {
  return <ViolationEntryPageContent searchParams={searchParams} />
}
