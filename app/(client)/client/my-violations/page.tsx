import { MyViolationsPageContent } from "@/components/domain/my-violations/MyViolationsComponents";
import RecordsRealtimeListener from "@/components/domain/violation/RecordsRealtimeListener";
import { ClientMainContent } from "@/components/layout/client/ClientMainContent";

export default async function MyViolationsPage() {
  // try {
  //   const supabase = await getSupabaseServer()
  //   const { data: userRes } = await supabase.auth.getUser()
  //   const authUid = userRes?.user?.id

  //   if (!authUid) redirect('/login')

  //   const { data: appUser } = await supabase
  //     .from('users')
  //     .select('id')
  //     .eq('auth_uid', authUid)
  //     .maybeSingle()

  //   const appUserId = appUser?.id as string | undefined
  //   if (!appUserId) redirect('/login')

  //   const { data: roles } = await supabase
  //     .from('user_roles')
  //     .select('role_id')
  //     .eq('user_id', appUserId)

  //   const hasSelfRole = Array.isArray(roles) && roles.some(r =>
  //     r.role_id === 'S' || r.role_id === 'YUM'
  //   )

  //   if (!hasSelfRole) redirect('/client')
  // } catch {
  //   redirect('/login')
  // }

  return (
    <ClientMainContent>
      <MyViolationsPageContent />
      <RecordsRealtimeListener />
    </ClientMainContent>
  );
}
