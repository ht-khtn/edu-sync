import { ViolationEntryPageContent, dynamic } from '@/components/violation-entry/ViolationEntryComponents'

export { dynamic }

export default function ViolationEntryPage({ searchParams }: { searchParams?: { ok?: string } }) {
  return <ViolationEntryPageContent searchParams={searchParams} />
}
