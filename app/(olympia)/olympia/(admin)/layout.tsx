import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminHeader } from "@/components/admin/layout/AdminHeader";
import { AdminMainContent } from "@/components/admin/layout/AdminMainContent";
import { OlympiaAdminSidebar } from "@/components/olympia/admin/layout/OlympiaAdminSidebar";
import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";
import { getServerAuthContext } from "@/lib/server-auth";

export default async function OlympiaAdminLayout({ children }: { children: ReactNode }) {
  try {
    await ensureOlympiaAdminAccess();
  } catch {
    // Check if user is authenticated
    const { appUserId } = await getServerAuthContext();
    if (!appUserId) {
      // Not authenticated - redirect to login
      // OlympiaAdminPathSaver component in root layout will save the current path
      return redirect('/login?redirect=/olympia/admin');
    }
    // Authenticated but no admin role - redirect to olympia client
    return redirect("/olympia/client");
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
