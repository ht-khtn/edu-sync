import type { Metadata } from "next";
import { redirect } from "next/navigation"
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/layout/AdminSidebar";
import { AdminHeader } from "@/components/admin/layout/AdminHeader";
import { AdminMainContent } from "@/components/admin/layout/AdminMainContent";
import { getServerAuthContext } from "@/lib/server-auth"

export const metadata: Metadata = {
  title: "Admin Panel - EduSync",
  description: "EduSync administrative panel",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side: ensure the user is authenticated
  // Role check is done in proxy.ts, so we only verify session exists
  const { appUserId } = await getServerAuthContext()
  if (!appUserId) return redirect('/login')

  const user = { id: appUserId }

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
