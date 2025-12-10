import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminHeader } from "@/components/admin/layout/AdminHeader";
import { AdminMainContent } from "@/components/admin/layout/AdminMainContent";
import { OlympiaAdminSidebar } from "@/components/olympia/layout/OlympiaAdminSidebar";
import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";

export default async function OlympiaAdminLayout({ children }: { children: ReactNode }) {
  try {
    await ensureOlympiaAdminAccess();
  } catch {
    redirect("/client");
  }

  return (
    <SidebarProvider defaultOpen={true} suppressHydrationWarning>
      <OlympiaAdminSidebar />
      <SidebarInset suppressHydrationWarning>
        <AdminHeader />
        <AdminMainContent>{children}</AdminMainContent>
      </SidebarInset>
    </SidebarProvider>
  );
}
