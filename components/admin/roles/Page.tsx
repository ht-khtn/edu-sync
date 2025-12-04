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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import QueryToasts from "@/components/common/QueryToasts";
import { AssignRoleDialog } from "./AssignRoleDialog";
import { RemoveRoleButton } from "./RemoveRoleButton";
import {
  fetchRolesData,
  fetchUserOptions,
  fetchClasses,
  fetchPermissions,
  calculateRoleDistribution,
  prepareUsersForDialog,
  prepareRolesForDialog,
  getUserFullName,
  getUserEmail,
  getPermission,
  formatCreatedDate,
  getParam,
} from "@/hooks/domain/useRoles";

type AdminRolesPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function AdminRolesPage({ searchParams }: AdminRolesPageProps) {
  const [{ supabase, appUserId }, userRoles] = await Promise.all([
    getServerAuthContext(),
    getServerRoles(),
  ]);

  if (!appUserId) redirect("/login");

  const summary = summarizeRoles(userRoles);
  if (!hasAdminManagementAccess(summary)) redirect("/admin");

  // Fetch all data using hook logic
  const [{ rows, error }, userOptions, classMap, permissionList] = await Promise.all([
    fetchRolesData(supabase),
    fetchUserOptions(supabase),
    fetchClasses(supabase),
    fetchPermissions(supabase),
  ]);

  const roleDistribution = calculateRoleDistribution(rows);
  const usersForDialog = prepareUsersForDialog(userOptions, classMap);
  const rolesForDialog = prepareRolesForDialog(permissionList);

  const okParam = getParam(searchParams, "ok");
  const errParam = getParam(searchParams, "error");

  return (
    <section className="space-y-6">
      <QueryToasts ok={okParam} error={errParam} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý vai trò</h1>
          <p className="text-muted-foreground mt-1">
            Theo dõi gán quyền, scope và target cho từng tài khoản.
          </p>
        </div>
        <AssignRoleDialog users={usersForDialog} roles={rolesForDialog} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phân bố vai trò</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(roleDistribution).map(([roleId, count]) => (
              <Badge key={roleId} variant="outline" className="text-sm">
                {roleId}: {count}
              </Badge>
            ))}
            {rows.length === 0 && (
              <p className="text-muted-foreground text-sm">Không có dữ liệu.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Lỗi tải dữ liệu vai trò: {String(error.message || error)}
          </AlertDescription>
        </Alert>
      )}

      {!error && rows.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center">
            Chưa có vai trò nào được gán.
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="bg-background rounded-lg border">
          <div className="px-4 py-3">
            <h2 className="text-lg font-semibold">Các gán quyền gần đây</h2>
            <p className="text-muted-foreground text-sm">
              Tối đa 300 bản ghi, sắp xếp theo thời gian.
            </p>
          </div>
          <Separator />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tài khoản</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead className="w-20">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const fullName = getUserFullName(row);
                  const email = getUserEmail(row);
                  const permission = getPermission(row);
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{fullName}</div>
                        {email && <div className="text-muted-foreground text-sm">{email}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.role_id}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {permission?.scope || "—"}
                      </TableCell>
                      <TableCell>{row.target || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatCreatedDate(row.created_at)}
                      </TableCell>
                      <TableCell>
                        <RemoveRoleButton
                          roleRecordId={row.id}
                          userDisplay={fullName}
                          roleId={row.role_id}
                        />
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
