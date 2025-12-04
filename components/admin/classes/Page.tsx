import { redirect } from "next/navigation";
import { getServerAuthContext, getServerRoles, summarizeRoles } from "@/lib/server-auth";
import { hasAdminManagementAccess } from "@/lib/admin-access";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import QueryToasts from "@/components/common/QueryToasts";
import { CreateClassDialog } from "./CreateClassDialog";
import { UpdateHomeroomDialog } from "./UpdateHomeroomDialog";
import {
  fetchClassesData,
  fetchTeachersByIds,
  getHomeroomIds,
  getUniqueGrades,
  fetchGradeList,
  fetchTeacherOptions,
  prepareClassesForDialog,
  calculateClassesStats,
  getGradeName,
  getTeacherDisplay,
  formatCreatedDate,
  getParam,
} from "@/hooks/domain/useClass";

type AdminClassesPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function AdminClassesPage({ searchParams }: AdminClassesPageProps) {
  const [{ supabase, appUserId }, roles] = await Promise.all([
    getServerAuthContext(),
    getServerRoles(),
  ]);

  if (!appUserId) redirect("/login");

  const summary = summarizeRoles(roles);
  if (!hasAdminManagementAccess(summary)) redirect("/admin");

  // Fetch classes data using hook logic
  const { classRows, error } = await fetchClassesData(supabase);

  // Get homeroom IDs and fetch teachers
  const homeroomIds = getHomeroomIds(classRows);
  const teacherMap = await fetchTeachersByIds(supabase, homeroomIds);

  // Get unique grades
  const gradeSet = getUniqueGrades(classRows);

  // Fetch grade list and teacher options
  const [gradeList, teacherOptions] = await Promise.all([
    fetchGradeList(supabase),
    fetchTeacherOptions(supabase),
  ]);

  // Prepare data for dialogs
  const classesForDialog = prepareClassesForDialog(classRows);

  // Calculate statistics
  const stats = calculateClassesStats(classRows, gradeSet, teacherMap);

  const okParam = getParam(searchParams, "ok");
  const errParam = getParam(searchParams, "error");

  return (
    <section className="space-y-6">
      <QueryToasts ok={okParam} error={errParam} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý lớp học</h1>
          <p className="text-muted-foreground mt-1">
            Tổng quan danh sách lớp, khối và giáo viên chủ nhiệm.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreateClassDialog grades={gradeList} teachers={teacherOptions} />
          <UpdateHomeroomDialog classes={classesForDialog} teachers={teacherOptions} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tổng số lớp</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats.totalClasses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Số khối</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats.totalGrades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GVCN đã gán</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats.assignedTeachers}</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Lỗi tải dữ liệu lớp: {String(error.message || error)}</AlertDescription>
        </Alert>
      )}

      {!error && classRows.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center">
            Chưa có lớp nào trong hệ thống.
          </CardContent>
        </Card>
      )}

      {classRows.length > 0 && (
        <div className="bg-background rounded-lg border">
          <div className="px-4 py-3">
            <h2 className="text-lg font-semibold">Danh sách lớp</h2>
            <p className="text-muted-foreground text-sm">Sắp xếp theo tên lớp.</p>
          </div>
          <Separator />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên lớp</TableHead>
                  <TableHead>Khối</TableHead>
                  <TableHead>Giáo viên CN</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classRows.map((row) => {
                  const gradeName = getGradeName(row);
                  const teacherDisplay = getTeacherDisplay(row, teacherMap);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name || row.id}</TableCell>
                      <TableCell>{gradeName}</TableCell>
                      <TableCell>
                        {teacherDisplay.isAssigned && teacherDisplay.name ? (
                          <span>{teacherDisplay.name}</span>
                        ) : (
                          <span className="text-muted-foreground">Chưa gán</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatCreatedDate(row.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}
