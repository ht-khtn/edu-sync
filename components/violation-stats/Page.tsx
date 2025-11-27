import { getServerAuthContext, getServerRoles, summarizeRoles } from "@/lib/server-auth";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import ClassAggClient from "@/components/violation-stats/ClassAggClient";
import ExportReportDialog from "@/components/violation-stats/ExportDialog";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type RecordRow = {
  score: number;
  criteria: { id: string; name: string | null } | null;
  class_id: string;
  classes: { name: string | null } | null;
};
// file touched to ensure editors/TS server reload recognize the latest content
export default async function ViolationStatsPageContent() {
  const { supabase, appUserId } = await getServerAuthContext();
  if (!appUserId) redirect("/login");

  // Require at least one role with permissions.scope = 'school'
  const roles = await getServerRoles();
  const summary = summarizeRoles(roles);
  if (!summary.canViewViolationStats) {
    return redirect(summary.canEnterViolations ? "/admin/violation-entry" : "/admin");
  }

  // Fetch minimal record fields for aggregation; exclude soft-deleted
  const { data: recs, error } = await supabase
    .from("records")
    .select("score, criteria(id,name), class_id, classes(name)")
    .is("deleted_at", null)
    .limit(20000);

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Lỗi truy vấn dữ liệu: {String(error.message || error)}
      </div>
    );
  }

  const rows = (recs || []) as unknown as RecordRow[];

  // Aggregate by criteria
  const byCriteria = new Map<
    string,
    { name: string; total: number; count: number }
  >();
  for (const r of rows) {
    const key = r.criteria?.id || "unknown";
    const name = r.criteria?.name || `#${String(key).slice(0, 6)}`;
    const m = byCriteria.get(key) || { name, total: 0, count: 0 };
    m.total += Number(r.score || 0);
    m.count += 1;
    byCriteria.set(key, m);
  }
  const criteriaAgg = Array.from(byCriteria.entries()).map(([id, v]) => ({
    id,
    ...v,
  }));
  criteriaAgg.sort((a, b) => b.total - a.total);

  // Aggregate by class
  const byClass = new Map<
    string,
    { name: string; total: number; count: number }
  >();
  for (const r of rows) {
    const key = r.class_id;
    const name = r.classes?.name || r.class_id;
    const m = byClass.get(key) || { name, total: 0, count: 0 };
    m.total += Number(r.score || 0);
    m.count += 1;
    byClass.set(key, m);
  }
  const classAgg = Array.from(byClass.entries()).map(([id, v]) => ({
    id,
    ...v,
  }));
  classAgg.sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <div
        className="flex items-start justify-between"
        suppressHydrationWarning
      >
        <div suppressHydrationWarning>
          <h1 className="text-3xl font-bold tracking-tight">
            Thống kê vi phạm
          </h1>
          <p className="text-muted-foreground mt-1">
            Tổng quan theo toàn bộ dữ liệu (chỉ dành cho người dùng phạm vi
            trường).
          </p>
        </div>
        <ExportReportDialog />
      </div>

      <Tabs defaultValue="criteria" className="w-full space-y-4">
        <TabsList className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-full sm:w-auto">
          <TabsTrigger
            value="criteria"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Theo lỗi vi phạm
          </TabsTrigger>
          <TabsTrigger
            value="class"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Theo lớp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="criteria" className="mt-0 space-y-4">
          <Card className="shadow-sm border-border">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold">
                    Tổng hợp theo lỗi vi phạm
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Danh sách các lỗi vi phạm được ghi nhận
                  </p>
                </div>
                <div
                  className="text-sm text-muted-foreground"
                  suppressHydrationWarning
                >
                  Tổng:{" "}
                  <span className="font-semibold text-foreground">
                    {criteriaAgg.length}
                  </span>{" "}
                  loại
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden" suppressHydrationWarning>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold">
                        Lỗi vi phạm
                      </TableHead>
                      <TableHead className="text-right font-semibold w-32">
                        Số lần
                      </TableHead>
                      <TableHead className="text-right font-semibold w-32">
                        Tổng điểm
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criteriaAgg.map((c, idx) => (
                      <TableRow key={c.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <div
                            className="flex items-center gap-2"
                            suppressHydrationWarning
                          >
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-xs font-semibold text-destructive">
                              {idx + 1}
                            </span>
                            {c.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.count}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-destructive">
                          {c.total}
                        </TableCell>
                      </TableRow>
                    ))}
                    {criteriaAgg.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="h-32 text-center text-muted-foreground"
                        >
                          Chưa có dữ liệu vi phạm.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="class" className="mt-0 space-y-4">
          <Card className="shadow-sm border-border">
            <CardHeader className="border-b bg-muted/30">
              <div
                className="flex items-center justify-between"
                suppressHydrationWarning
              >
                <div suppressHydrationWarning>
                  <CardTitle className="text-xl font-semibold">
                    Tổng hợp theo lớp
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Thống kê điểm vi phạm của từng lớp
                  </p>
                </div>
                <div
                  className="text-sm text-muted-foreground"
                  suppressHydrationWarning
                >
                  Tổng:{" "}
                  <span className="font-semibold text-foreground">
                    {classAgg.length}
                  </span>{" "}
                  lớp
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <ClassAggClient classAgg={classAgg} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
