import type { Metadata } from "next";
import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/layout/admin/AdminSidebar";
import { AdminHeader } from "@/components/layout/admin/AdminHeader";
import { AdminMainContent } from "@/components/layout/admin/AdminMainContent";
import { getServerAuthContext } from "@/lib/server-auth"

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
