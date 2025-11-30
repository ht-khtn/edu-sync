import type { Metadata } from "next";
import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/layout/admin/AdminSidebar";
import { AdminHeader } from "@/components/layout/admin/AdminHeader";
import { AdminMainContent } from "@/components/layout/admin/AdminMainContent";
import { getServerAuthContext, getServerRoles, summarizeRoles } from "@/lib/server-auth"

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
  // Server-side: ensure the user is authenticated and has admin/CC access
  const { appUserId } = await getServerAuthContext()
  if (!appUserId) return redirect('/login')

  const roles = await getServerRoles()
  const summary = summarizeRoles(roles)
  if (summary.isStudentOnly) return redirect('/client')

  const user = { id: appUserId }

  return (
    <SidebarProvider defaultOpen={true} suppressHydrationWarning>
      <AdminSidebar
        canEnterViolations={summary.canEnterViolations}
        canViewViolationStats={summary.canViewViolationStats}
        canManageSystem={summary.canManageSystem}
      />
      <SidebarInset suppressHydrationWarning>
        <AdminHeader user={user} />
        <AdminMainContent>{children}</AdminMainContent>
      </SidebarInset>
    </SidebarProvider>
  );
}
