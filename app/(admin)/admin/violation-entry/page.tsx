import { redirect } from 'next/navigation'
import { ViolationEntryPageContent } from '@/components/admin/violation-entry/ViolationEntryComponents'
import QueryToasts from '@/components/common/QueryToasts'
import RecordsRealtimeListener from '@/components/admin/violation/RecordsRealtimeListener'
import { getServerAuthContext, getServerRoles, summarizeRoles } from '@/lib/server-auth'

// ISR: Revalidate every 60s. User list + criteria cached.
export const revalidate = 60

export default async function ViolationEntryPage({ 
  searchParams 
}: { 
  searchParams?: { ok?: string, error?: string } 
}) {
  const [{ appUserId }, roles] = await Promise.all([
    getServerAuthContext(),
    getServerRoles()
  ])
  
  if (!appUserId) return redirect('/login')

  const summary = summarizeRoles(roles)
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
