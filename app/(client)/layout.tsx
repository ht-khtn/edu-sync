import type { Metadata } from "next";
import { ClientHeader } from "@/components/client/ClientHeader";
import getSupabaseServer from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "EduSync",
  description:
    "Hệ thống hỗ trợ quản lý phong trào và thi đua dành cho học sinh THPT",
};

export const dynamic = "force-dynamic";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user: { id: string } | null = { id: "temp-user" };
  const hasAdminAccess = false;

  // try {
  //   const supabase = await getSupabaseServer()
  //   const { data: userRes } = await supabase.auth.getUser()
  //   const authUid = userRes?.user?.id

  //   if (authUid) {
  //     const { data: appUser } = await supabase
  //       .from('users')
  //       .select('id')
  //       .eq('auth_uid', authUid)
  //       .maybeSingle()

  //     const appUserId = appUser?.id as string | undefined

  //     if (appUserId) {
  //       user = { id: appUserId }

  //       const { data: roles } = await supabase
  //         .from('user_roles')
  //         .select('role_id')
  //         .eq('user_id', appUserId)

  //       hasAdminAccess = Array.isArray(roles) && roles.some(r =>
  //         r.role_id === 'CC' || r.role_id === 'Admin'
  //       )
  //     }
  //   }
  // } catch {
  //   user = null
  // }

  return (
    <>
      <ClientHeader user={user} hasAdminAccess={hasAdminAccess} />
      {children}
    </>
  );
}
