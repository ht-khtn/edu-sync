import { redirect } from 'next/navigation'
import { ViolationEntryPageContent } from '@/components/domain/violation-entry/ViolationEntryComponents'
import QueryToasts from '@/components/common/QueryToasts'
import RecordsRealtimeListener from '@/components/domain/violation/RecordsRealtimeListener'
import { getServerAuthContext, getServerRoles, summarizeRoles } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export default async function ViolationEntryPage({ 
  searchParams 
}: { 
  searchParams?: { ok?: string, error?: string } 
}) {
  const { appUserId } = await getServerAuthContext()
  if (!appUserId) return redirect('/login')

  const summary = summarizeRoles(await getServerRoles())
  if (!summary.canEnterViolations) {
    return redirect(summary.canViewViolationStats ? '/admin/violation-stats' : '/admin')
  }

  return (
    <>
      <ViolationEntryPageContent />
      <QueryToasts ok={searchParams?.ok} error={searchParams?.error} />
      <RecordsRealtimeListener />
    </>
  )
}
