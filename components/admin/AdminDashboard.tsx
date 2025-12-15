"use client"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, Building2, FileText, ShieldCheck, Trophy, Users, AlertTriangle, KeySquare, GraduationCap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useAdminPermissions } from "@/hooks/domain/useAdminPermissions";

type DashboardCard = {
  title: string
  description: string
  icon: LucideIcon
  href: string
  requiredPermission?: keyof Omit<ReturnType<typeof useAdminPermissions>, 'isLoading'>
}

const allDashboardCards: ReadonlyArray<DashboardCard> = [
  {
    title: "Bảng xếp hạng",
    description: "Xem bảng xếp hạng của các lớp trong khối",
    icon: Trophy,
    href: "/admin/leaderboard",
    requiredPermission: "canViewViolationStats",
  },
  {
    title: "Ghi nhận vi phạm",
    description: "Ghi nhận các vi phạm mới",
    icon: FileText,
    href: "/admin/violation-entry",
    requiredPermission: "canEnterViolations",
  },
  {
    title: "Lịch sử vi phạm",
    description: "Xem lại các vi phạm đã ghi nhận",
    icon: Users,
    href: "/admin/violation-history",
    requiredPermission: "canViewViolationStats",
  },
  {
    title: "Thống kê",
    description: "Phân tích xu hướng vi phạm",
    icon: BarChart3,
    href: "/admin/violation-stats",
    requiredPermission: "canViewViolationStats",
  },
  {
    title: "Tiêu chí vi phạm",
    description: "Thêm/sửa tiêu chí trừ điểm",
    icon: AlertTriangle,
    href: "/admin/criteria",
    requiredPermission: "canManageSystem",
  },
  {
    title: "Quản lý tài khoản",
    description: "Danh sách và trạng thái người dùng",
    icon: Users,
    href: "/admin/accounts",
    requiredPermission: "canManageSystem",
  },
  {
    title: "Quản lý vai trò",
    description: "Gán quyền và target",
    icon: ShieldCheck,
    href: "/admin/roles",
    requiredPermission: "canManageSystem",
  },
  {
    title: "Danh bạ lớp",
    description: "Thông tin lớp và GVCN",
    icon: Building2,
    href: "/admin/classes",
    requiredPermission: "canManageSystem",
  },
  {
    title: "Olympia Admin",
    description: "Cấp quyền và quản lý ban tổ chức Olympia",
    icon: KeySquare,
    href: "/admin/olympia-accounts",
    requiredPermission: "hasOlympiaAccess",
  },
  {
    title: "Olympia Thí sinh",
    description: "Đi tới trang quản lý tài khoản thi Olympia",
    icon: GraduationCap,
    href: "/olympia/admin/accounts?role=contestant",
    requiredPermission: "hasOlympiaAccess",
  },
] as const;

export default function AdminDashboard() {
  const permissions = useAdminPermissions()

  // Filter cards based on user permissions
  const visibleCards = allDashboardCards.filter((card) => {
    if (!card.requiredPermission) return true
    return permissions[card.requiredPermission]
  })

  return (
    <div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      suppressHydrationWarning
    >
      {visibleCards.map((card) => {
        const Icon = card.icon;
        return (
          <Link key={card.href} href={card.href} className="group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 bg-card">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-primary/10 p-3 text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold">
                    {card.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {card.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
