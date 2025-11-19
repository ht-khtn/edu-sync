import { getServerAuthContext, getServerRoles, summarizeRoles } from "@/lib/server-auth";
import { redirect } from "next/navigation";
import { fetchCriteriaFromDB, fetchStudentsFromDB } from "@/lib/violations";
import { getAllowedClassIdsForView } from "@/lib/rbac";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Filters from "@/components/violation-history/Filters";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

export const dynamic = "force-dynamic";

type Search = {
  classId?: string;
  studentId?: string;
  criteriaId?: string;
  start?: string;
  end?: string;
};

export default async function ViolationHistoryPageContent({
  searchParams,
}: {
  searchParams?: Search;
}) {
  // Auth + role guard (reuse CC access rule for now)
  const { supabase, appUserId } = await getServerAuthContext();
  if (!appUserId) redirect("/login");
  // Fetch roles with scope info so we allow both CC (class-committee) and school-scoped roles
  const summary = summarizeRoles(await getServerRoles());
  if (!summary.hasCC && !summary.hasSchoolScope) {
    return redirect("/");
  }

  // Allowed classes for viewing (null => all)
  const allowedViewClassIds = await getAllowedClassIdsForView(
    supabase,
    appUserId
  );

  // Fetch classes list (respect allowed set if not null)
  let { data: classes } = await supabase
    .from("classes")
    .select("id,name")
    .order("name");
  if (allowedViewClassIds) {
    classes = (classes || []).filter((c: any) => allowedViewClassIds.has(c.id));
  }

  // Fetch students (filtered to allowed classes)
  // Fetch students directly filtered by allowed class ids (single query) for performance
  const students = await fetchStudentsFromDB(
    supabase,
    undefined,
    allowedViewClassIds === null ? null : allowedViewClassIds
  );

  // Fetch criteria list
  const criteriaList = await fetchCriteriaFromDB(supabase);

  // Build records query with filters
  let query = supabase
    .from("records")
    .select(
      "id, created_at, student_id, class_id, score, note, classes(id,name), criteria(id,name), users:student_id(user_profiles(full_name), user_name)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (allowedViewClassIds) {
    query = query.in("class_id", Array.from(allowedViewClassIds));
  }
  if (searchParams?.classId) query = query.eq("class_id", searchParams.classId);
  if (searchParams?.studentId)
    query = query.eq("student_id", searchParams.studentId);
  if (searchParams?.criteriaId)
    query = query.eq("criteria_id", searchParams.criteriaId);
  if (searchParams?.start) {
    const startDate = new Date(searchParams.start);
    if (!isNaN(startDate.getTime()))
      query = query.gte("created_at", startDate.toISOString());
  }
  if (searchParams?.end) {
    const endDate = new Date(searchParams.end);
    if (!isNaN(endDate.getTime())) {
      // Add 1 day 23:59 buffer inclusive
      endDate.setHours(23, 59, 59, 999);
      query = query.lte("created_at", endDate.toISOString());
    }
  }

  const { data: rows, error: rowsErr } = await query;

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <h1 className="text-3xl font-bold tracking-tight">Lịch sử vi phạm</h1>
      </div>

      <ErrorBoundary>
        <Filters
          initial={{
            classId: searchParams?.classId || "",
            studentId: searchParams?.studentId || "",
            criteriaId: searchParams?.criteriaId || "",
            start: searchParams?.start || "",
            end: searchParams?.end || "",
          }}
          classes={(classes || []).map((c: any) => ({
            id: c.id,
            name: c.name || c.id,
          }))}
          students={students.map((s) => ({
            id: s.id,
            name: s.full_name || s.user_name || s.id.slice(0, 8),
          }))}
          criteria={criteriaList.map((c) => ({ id: c.id, name: c.name }))}
        />
      </ErrorBoundary>

      {rowsErr && (
        <Alert variant="destructive">
          <AlertDescription>
            Lỗi truy vấn records: {String(rowsErr.message || rowsErr)}
          </AlertDescription>
        </Alert>
      )}

      {!rowsErr && (!rows || rows.length === 0) && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">
              Không có ghi nhận phù hợp với bộ lọc hiện tại.
            </p>
          </CardContent>
        </Card>
      )}

      {rows && rows.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-hidden" suppressHydrationWarning>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Thời gian</TableHead>
                    <TableHead className="font-semibold">Lớp</TableHead>
                    <TableHead className="font-semibold">Học sinh</TableHead>
                    <TableHead className="font-semibold">Tiêu chí</TableHead>
                    <TableHead className="text-right font-semibold">
                      Điểm
                    </TableHead>
                    <TableHead className="font-semibold">Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r: any) => {
                    const fullName =
                      (r.users?.user_profiles &&
                      Array.isArray(r.users.user_profiles)
                        ? r.users.user_profiles[0]?.full_name
                        : r.users?.user_profiles?.full_name) ||
                      r.users?.user_name ||
                      "—";
                    return (
                      <TableRow key={r.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString("vi-VN", {
                            timeZone: "Asia/Ho_Chi_Minh",
                          })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.classes?.name || r.class_id}
                        </TableCell>
                        <TableCell>{fullName}</TableCell>
                        <TableCell className="text-sm">
                          {r.criteria?.name ||
                            (r.criteria?.id
                              ? `#${String(r.criteria.id).slice(0, 8)}`
                              : "—")}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-destructive">
                          {r.score}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground max-w-xs truncate text-sm"
                          title={r.note}
                        >
                          {r.note || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
