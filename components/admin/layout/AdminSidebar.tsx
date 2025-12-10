"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  FileText,
  BarChart3,
  History,
  Users,
  ShieldCheck,
  Building2,
  AlertTriangle,
  GraduationCap,
  KeySquare,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAdminPermissions } from "@/hooks/domain/useAdminPermissions";
import { getPrefetchConfig } from "@/lib/link-optimizer";
import { Skeleton } from "@/components/ui/skeleton";

import type { LucideIcon } from "lucide-react";

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  requires?: "violation-entry" | "violation-stats" | "system-management" | "olympia"
}

const operationsNavItems: ReadonlyArray<NavItem> = [
  {
    title: "Bảng điều khiển",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Bảng xếp hạng",
    href: "/admin/leaderboard",
    icon: Trophy,
  },
  {
    title: "Nhập vi phạm",
    href: "/admin/violation-entry",
    icon: FileText,
    requires: "violation-entry",
  },
  {
    title: "Lịch sử vi phạm",
    href: "/admin/violation-history",
    icon: History,
  },
  {
    title: "Thống kê vi phạm",
    href: "/admin/violation-stats",
    icon: BarChart3,
    requires: "violation-stats",
  },
] as const;

const managementNavItems: ReadonlyArray<NavItem> = [
  {
    title: "Tài khoản",
    href: "/admin/accounts",
    icon: Users,
    requires: "system-management",
  },
  {
    title: "Tiêu chí vi phạm",
    href: "/admin/criteria",
    icon: AlertTriangle,
    requires: "system-management",
  },
  {
    title: "Vai trò",
    href: "/admin/roles",
    icon: ShieldCheck,
    requires: "system-management",
  },
  {
    title: "Lớp học",
    href: "/admin/classes",
    icon: Building2,
    requires: "system-management",
  },
] as const;

const olympiaNavItems: ReadonlyArray<NavItem> = [
  {
    title: "Olympia Admin",
    href: "/admin/olympia-accounts",
    icon: KeySquare,
    requires: "olympia",
  },
  {
    title: "Olympia Thí sinh",
    href: "/olympia/admin/accounts?role=contestant",
    icon: GraduationCap,
    requires: "olympia",
  },
] as const;

function AdminSidebarComponent() {
  const pathname = usePathname();
  const permissions = useAdminPermissions();
  const isLoading = permissions.isLoading;
  
  // Filter items based on permissions - using callback for stability
  const getVisibleItems = React.useCallback((items: ReadonlyArray<NavItem>) => {
    return items.filter((item) => {
      if (item.requires === "violation-entry") return permissions.canEnterViolations;
      if (item.requires === "violation-stats") return permissions.canViewViolationStats;
      if (item.requires === "system-management") return permissions.canManageSystem;
      if (item.requires === "olympia") return permissions.hasOlympiaAccess;
      return true;
    });
  }, [permissions]);

  const filteredOperations = React.useMemo(() => getVisibleItems(operationsNavItems), [getVisibleItems]);
  const filteredManagement = React.useMemo(() => getVisibleItems(managementNavItems), [getVisibleItems]);
  const filteredOlympia = React.useMemo(() => getVisibleItems(olympiaNavItems), [getVisibleItems]);

  if (isLoading) {
    return (
      <Sidebar className="border-r border-sidebar-border bg-sidebar" suppressHydrationWarning>
        <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
          <div className="flex items-center gap-2 px-4 py-4" suppressHydrationWarning>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">E</span>
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-28 bg-muted/70" />
              <Skeleton className="h-3 w-16 bg-muted/70" />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="bg-sidebar">
          <div className="space-y-3 p-4">
            <Skeleton className="h-8 w-full bg-muted/70" />
            <Skeleton className="h-8 w-full bg-muted/70" />
            <Skeleton className="h-8 w-full bg-muted/70" />
          </div>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border bg-sidebar">
          <div className="p-4 text-xs text-muted-foreground">EduSync v1.0</div>
        </SidebarFooter>
      </Sidebar>
    );
  }

  const renderNavItems = (items: ReadonlyArray<NavItem>) => (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        const config = getPrefetchConfig(item.href);
        const shouldPrefetch = config.prefetch !== false;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <Link href={item.href} prefetch={shouldPrefetch}>
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar
      className="border-r border-sidebar-border bg-sidebar"
      suppressHydrationWarning
    >
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
        <div
          className="flex items-center gap-2 px-4 py-4"
          suppressHydrationWarning
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-lg font-bold">E</span>
          </div>
          <Link
            href="/admin"
            className="text-lg font-semibold tracking-tight text-sidebar-foreground hover:text-primary transition-colors"
          >
            EduSync Admin
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Quản lý
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderNavItems(filteredOperations)}
          </SidebarGroupContent>
        </SidebarGroup>
        
        {filteredManagement.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Hệ thống
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {renderNavItems(filteredManagement)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        
        {filteredOlympia.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Olympia
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {renderNavItems(filteredOlympia)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border bg-sidebar">
        <div className="p-4 text-xs text-muted-foreground">EduSync v1.0</div>
      </SidebarFooter>
    </Sidebar>
  );
}

export const AdminSidebar = React.memo(AdminSidebarComponent);
