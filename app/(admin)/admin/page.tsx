import AdminDashboard from "@/components/admin/AdminDashboard";

// ISR: Cache for 1 hour, dashboard is static layout with role-filtered content
export const revalidate = 3600;

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <h1 className="text-3xl font-bold tracking-tight">Bảng điều khiển</h1>
        <p className="text-muted-foreground mt-1">
          Chào mừng đến với bảng điều khiển quản trị viên.
        </p>
      </div>

      <AdminDashboard />
    </div>
  );
}
