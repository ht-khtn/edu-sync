import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CriteriaTable } from "./CriteriaTable";
import { CriteriaFilters } from "./CriteriaFilters";
import { CreateCriteriaDialog } from "./CreateCriteriaDialog";
import QueryToasts from "@/components/common/QueryToasts";
import { getServerSupabase, getServerRoles, summarizeRoles } from "@/lib/server-auth";
import { hasAdminManagementAccess } from "@/lib/admin-access";
import {
  fetchCriteriaData,
  normalizeFilter,
  applyFilters,
  summarizeCriteria,
  formatSummary,
  getParam,
} from "@/hooks/domain/useCriteria";

export default async function AdminCriteriaPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // Auth handled by middleware - only check admin access for granular permissions
  const [supabase, roles] = await Promise.all([
    getServerSupabase(),
    getServerRoles(),
  ]);

  const summary = summarizeRoles(roles);
  if (!hasAdminManagementAccess(summary)) redirect("/admin");

  // Fetch criteria data using hook logic
  const criteria = await fetchCriteriaData(supabase);
  const filters = normalizeFilter(searchParams);
  const filteredRows = applyFilters(criteria, filters);
  const stats = summarizeCriteria(criteria);

  const okParam = getParam(searchParams, "ok");
  const errParam = getParam(searchParams, "error");

  return (
    <section className="space-y-6">
      <QueryToasts ok={okParam} error={errParam} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý tiêu chí vi phạm</h1>
          <p className="text-muted-foreground mt-1">
            Cấu hình tiêu chí dùng để ghi nhận vi phạm. Chỉ AD/MOD được truy cập.
          </p>
        </div>
        <CreateCriteriaDialog />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <SummaryCard title="Đang sử dụng" value={`${stats.active}/${stats.total}`} />
        <SummaryCard title="Theo phạm vi" value={formatSummary(stats.byCategory)} />
        <SummaryCard title="Theo mức độ" value={formatSummary(stats.byType)} />
      </div>

      <CriteriaFilters initial={filters} />

      {criteria.length === 0 ? (
        <Alert>
          <AlertDescription>
            Chưa có tiêu chí nào. Hãy tạo mới để bắt đầu sử dụng module vi phạm.
          </AlertDescription>
        </Alert>
      ) : (
        <CriteriaTable rows={filteredRows} />
      )}
    </section>
  );
}

function SummaryCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold wrap-break-word">{value}</div>
      </CardContent>
    </Card>
  );
}
