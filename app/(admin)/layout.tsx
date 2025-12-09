import type { Metadata } from "next";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/layout/AdminSidebar";
import { AdminHeader } from "@/components/admin/layout/AdminHeader";
import { AdminMainContent } from "@/components/admin/layout/AdminMainContent";

export const metadata: Metadata = {
  title: "Admin Panel - EduSync",
  description: "EduSync administrative panel",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth is handled by middleware (proxy.ts) - no need to re-check here
  // This improves performance by avoiding redundant database queries

  return (
    <SidebarProvider defaultOpen={true} suppressHydrationWarning>
      <AdminSidebar />
      <SidebarInset suppressHydrationWarning>
        <AdminHeader />
        <AdminMainContent>{children}</AdminMainContent>
      </SidebarInset>
    </SidebarProvider>
  );
}
