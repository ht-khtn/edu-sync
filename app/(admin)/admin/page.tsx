import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, Building2, FileText, ShieldCheck, Trophy, Users, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { getServerRoles, summarizeRoles } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

type DashboardCard = {
  title: string
  description: string
  icon: LucideIcon
  href: string
  requires?: "violation-entry" | "violation-stats" | "management"
}

const baseDashboardCards: ReadonlyArray<DashboardCard> = [
  {
    title: "Bảng xếp hạng",
    description: "Xem bảng xếp hạng của các lớp trong khối",
    icon: Trophy,
    href: "/admin/leaderboard",
  },
  {
    title: "Ghi nhận vi phạm",
    description: "Ghi nhận các vi phạm mới",
    icon: FileText,
    href: "/admin/violation-entry",
    requires: "violation-entry",
  },
  {
    title: "Lịch sử vi phạm",
    description: "Xem lại các vi phạm đã ghi nhận",
    icon: Users,
    href: "/admin/violation-history",
  },
  {
    title: "Thống kê",
    description: "Phân tích xu hướng vi phạm",
    icon: BarChart3,
    href: "/admin/violation-stats",
    requires: "violation-stats",
  },
  {
    title: "Tiêu chí vi phạm",
    description: "Thêm/sửa tiêu chí trừ điểm",
    icon: AlertTriangle,
    href: "/admin/criteria",
    requires: "management",
  },
  {
    title: "Quản lý tài khoản",
    description: "Danh sách và trạng thái người dùng",
    icon: Users,
    href: "/admin/accounts",
    requires: "management",
  },
  {
    title: "Quản lý vai trò",
    description: "Gán quyền và target",
    icon: ShieldCheck,
    href: "/admin/roles",
    requires: "management",
  },
  {
    title: "Danh bạ lớp",
    description: "Thông tin lớp và GVCN",
    icon: Building2,
    href: "/admin/classes",
    requires: "management",
  },
] as const;

export default async function AdminDashboardPage() {
  const roles = await getServerRoles();
  const summary = summarizeRoles(roles);
  const dashboardCards = baseDashboardCards.filter((card) => {
    if (card.requires === "violation-entry") return summary.canEnterViolations;
    if (card.requires === "violation-stats") return summary.canViewViolationStats;
    if (card.requires === "management") return summary.canManageSystem;
    return true;
  });

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <h1 className="text-3xl font-bold tracking-tight">Bảng điều khiển</h1>
        <p className="text-muted-foreground mt-1">
          Chào mừng đến với bảng điều khiển quản trị viên.
        </p>
      </div>

      <div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        suppressHydrationWarning
      >
  {dashboardCards.map((card) => {
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
    </div>
  );
}
