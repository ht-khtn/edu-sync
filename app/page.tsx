import { redirect } from "next/navigation";
import getSupabaseServer from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  try {
    const supabase = await getSupabaseServer()
    const { data: userRes } = await supabase.auth.getUser()
    const authUid = userRes?.user?.id
    if (!authUid) return redirect('/client')
    const { data: appUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', authUid)
      .maybeSingle()
    const appUserId = appUser?.id as string | undefined
    if (!appUserId) return redirect('/client')
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', appUserId)
    const roleIds: string[] = Array.isArray(roles) ? roles.map((r: any) => r.role_id) : []
    const isStudentOnly = roleIds.length === 0 || roleIds.every(r => r === 'S' || r === 'YUM')
    return redirect(isStudentOnly ? '/client' : '/admin')
  } catch {
    return redirect('/client')
  }
}
