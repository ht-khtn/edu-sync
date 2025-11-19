import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, FileText, Trophy, Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const dashboardCards = [
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
  },
] as const;

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to the EduSync admin panel
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
