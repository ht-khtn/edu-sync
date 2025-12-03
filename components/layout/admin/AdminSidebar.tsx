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

import type { LucideIcon } from "lucide-react";

type AdminSidebarProps = {
  canEnterViolations: boolean
  canViewViolationStats: boolean
  canManageSystem: boolean
}

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  requires?: "violation-entry" | "violation-stats"
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

const managementNavItems = [
  {
    title: "Tài khoản",
    href: "/admin/accounts",
    icon: Users,
  },
  {
    title: "Tiêu chí vi phạm",
    href: "/admin/criteria",
    icon: AlertTriangle,
  },
  {
    title: "Vai trò",
    href: "/admin/roles",
    icon: ShieldCheck,
  },
  {
    title: "Lớp học",
    href: "/admin/classes",
    icon: Building2,
  },
] as const satisfies ReadonlyArray<{ title: string; href: string; icon: LucideIcon }>;

function AdminSidebarComponent({ canEnterViolations, canViewViolationStats, canManageSystem }: AdminSidebarProps) {
  const pathname = usePathname();
  const filteredOperations = React.useMemo(() => {
    return operationsNavItems.filter((item) => {
      if (item.requires === "violation-entry") return canEnterViolations;
      if (item.requires === "violation-stats") return canViewViolationStats;
      return true;
    });
  }, [canEnterViolations, canViewViolationStats]);

  const renderNavItems = (items: ReadonlyArray<{ title: string; href: string; icon: LucideIcon }>) => (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <Link href={item.href}>
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
        {canManageSystem && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Hệ thống
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {renderNavItems(managementNavItems)}
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
