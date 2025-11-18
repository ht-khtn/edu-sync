import type { Metadata } from "next";
// import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMainContent } from "@/components/admin/AdminMainContent";
// import getSupabaseServer from "@/lib/supabase-server"

export const metadata: Metadata = {
  title: "Admin Panel - EduSync",
  description: "EduSync administrative panel",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user: { id: string } | null = { id: "temp-user" };
  // let hasAdminAccess = false

  // try {
  //   const supabase = await getSupabaseServer()
  //   const { data: userRes } = await supabase.auth.getUser()
  //   const authUid = userRes?.user?.id

  //   if (!authUid) {
  //     redirect('/login')
  //   }

  //   const { data: appUser } = await supabase
  //     .from('users')
  //     .select('id')
  //     .eq('auth_uid', authUid)
  //     .maybeSingle()

  //   const appUserId = appUser?.id as string | undefined

  //   if (!appUserId) {
  //     redirect('/login')
  //   }

  //   const { data: roles } = await supabase
  //     .from('user_roles')
  //     .select('role_id')
  //     .eq('user_id', appUserId)

  //   hasAdminAccess = Array.isArray(roles) && roles.some(r =>
  //     r.role_id === 'CC' || r.role_id === 'Admin'
  //   )

  //   if (!hasAdminAccess) {
  //     redirect('/client')
  //   }

  //   user = { id: appUserId }
  // } catch (error) {
  //   redirect('/login')
  // }

  return (
    <SidebarProvider defaultOpen={true} suppressHydrationWarning>
      <AdminSidebar />
      <SidebarInset suppressHydrationWarning>
        <AdminHeader user={user} />
        <AdminMainContent>{children}</AdminMainContent>
      </SidebarInset>
    </SidebarProvider>
  );
}
