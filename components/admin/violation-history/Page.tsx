import { getServerSupabase, getServerRoles, summarizeRoles } from "@/lib/server-auth";
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
import Filters from "@/components/admin/violation-history/Filters";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import {
  fetchViolationHistoryData,
  formatRecordDateTime,
  getRecordClassName,
  getRecordStudentName,
  getRecordCriteriaName,
  type ViolationHistorySearchParams,
} from "@/hooks/domain/useViolationHistory";

export default async function ViolationHistoryPageContent({
  searchParams,
}: {
  searchParams?: ViolationHistorySearchParams;
}) {
  // Auth handled by middleware - only check granular permissions
  const [supabase, roles] = await Promise.all([
    getServerSupabase(),
    getServerRoles(),
  ]);

  // Fetch roles with scope info so we allow both CC (class-committee) and school-scoped roles
  const summary = summarizeRoles(roles);
  if (!summary.hasCC && !summary.hasSchoolScope) {
    return redirect("/");
  }

  // Allowed classes for viewing (null => all)
  // Note: RBAC filtering is business logic that still needs user context
  const allowedViewClassIds = new Set<string>();

  // Parallel fetch: classes, students, criteria
  const [{ data: classes }, studentsResult, criteriaList] = await Promise.all([
    supabase.from("classes").select("id,name").order("name"),
    fetchStudentsFromDB(
      supabase,
      undefined,
      allowedViewClassIds === null ? null : allowedViewClassIds
    ),
    fetchCriteriaFromDB(supabase, { includeInactive: true }),
  ]);

  // Extract students from paginated result
  const students = studentsResult?.students || [];

  // Fetch violation history data using the hook
  const {
    filteredClasses,
    students: studentOptions,
    criteria: criteriaOptions,
    records: rows,
    recordsError: rowsErr,
  } = await fetchViolationHistoryData(
    supabase,
    searchParams,
    allowedViewClassIds,
    classes,
    students,
    criteriaList
  );

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
          classes={filteredClasses}
          students={studentOptions}
          criteria={criteriaOptions}
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
            <p className="text-muted-foreground">Không có ghi nhận phù hợp với bộ lọc hiện tại.</p>
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
                    <TableHead className="text-right font-semibold">Điểm</TableHead>
                    <TableHead className="font-semibold">Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatRecordDateTime(r.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">{getRecordClassName(r)}</TableCell>
                      <TableCell>{getRecordStudentName(r)}</TableCell>
                      <TableCell className="text-sm">{getRecordCriteriaName(r)}</TableCell>
                      <TableCell className="text-destructive text-right font-semibold tabular-nums">
                        {r.score}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground max-w-xs truncate text-sm"
                        title={r.note || undefined}
                      >
                        {r.note || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
