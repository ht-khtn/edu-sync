import { ViolationEntryPageContent } from '@/components/violation-entry/ViolationEntryComponents'
import QueryToasts from '@/components/common/QueryToasts'
import getSupabaseServer from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'

export default async function ViolationEntryPage({ searchParams }: { searchParams?: { ok?: string, error?: string } }) {
  // Guard: only CC role can access
  try {
    const supabase = await getSupabaseServer()
    const { data: userRes } = await supabase.auth.getUser()
    const authUid = userRes?.user?.id
    if (!authUid) redirect('/login')
    const { data: appUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', authUid)
      .maybeSingle()
    const appUserId = appUser?.id as string | undefined
    if (!appUserId) redirect('/login')
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', appUserId)
    const hasCC = Array.isArray(roles) && roles.some(r => r.role_id === 'CC')
    if (!hasCC) redirect('/')
  } catch {}

  return (
    <>
      <ViolationEntryPageContent searchParams={searchParams} />
      <QueryToasts ok={searchParams?.ok} error={searchParams?.error} />
    </>
  )
}
