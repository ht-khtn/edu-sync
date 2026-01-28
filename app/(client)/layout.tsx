import type { Metadata } from "next";
import { ClientHeader } from "@/components/client/layout/ClientHeader";
import { redirect } from "next/navigation";
import { getServerAuthContext, getServerRoles, getServerSupabase, summarizeRoles } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "EduSync",
  description:
    "Hệ thống hỗ trợ quản lý phong trào và thi đua dành cho học sinh THPT",
};

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const [{ appUserId }, roles] = await Promise.all([
    getServerAuthContext(),
    getServerRoles()
  ])

  if (!appUserId) {
    return redirect('/login?redirect=/client')
  }

  const { isStudentOnly } = summarizeRoles(roles)

  if (!isStudentOnly) {
    return redirect('/admin')
  }

  const supabase = await getServerSupabase()
  const { data: userRow } = await supabase
    .from('users')
    .select('user_name, user_profiles(full_name)')
    .eq('id', appUserId)
    .maybeSingle()

  const profile = Array.isArray(userRow?.user_profiles)
    ? userRow?.user_profiles[0]
    : userRow?.user_profiles
  const displayName = profile?.full_name?.trim() ?? userRow?.user_name?.trim() ?? null

  return (
    <>
      <ClientHeader user={{ id: appUserId, displayName }} />
      {children}
    </>
  )
}
