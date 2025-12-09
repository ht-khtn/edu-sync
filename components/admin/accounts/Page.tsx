import { redirect } from "next/navigation";
import { getServerSupabase, getServerRoles, summarizeRoles } from "@/lib/server-auth";
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
import { CreateAccountDialog } from "./CreateAccountDialog";
import {
  fetchAccountsData,
  calculateAccountsStats,
  getUserFullName,
  getUserPhone,
  getClassName,
  getUserRoles,
  formatCreatedDate,
  getParam,
} from "@/hooks/domain/useAccounts";

type AdminAccountsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function AdminAccountsPage({ searchParams }: AdminAccountsPageProps) {
  // Auth handled by middleware - only check admin access
  const [supabase, roles] = await Promise.all([
    getServerSupabase(),
    getServerRoles(),
  ]);

  const summary = summarizeRoles(roles);
  if (!hasAdminManagementAccess(summary)) redirect("/admin");

  // Fetch accounts data using hook logic
  const { rows, classOptions, classMap, error } = await fetchAccountsData(supabase);

  // Calculate statistics
  const { totalAccounts, uniqueClassesCount, uniqueRolesCount } = calculateAccountsStats(
    rows,
    classMap
  );

  const okParam = getParam(searchParams, "ok");
  const errParam = getParam(searchParams, "error");

  return (
    <section className="space-y-6">
      <QueryToasts ok={okParam} error={errParam} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý tài khoản</h1>
          <p className="text-muted-foreground mt-1">
            Danh sách tài khoản người dùng nội bộ, chỉ hiển thị cho AD và MOD.
          </p>
        </div>
        <CreateAccountDialog classes={classOptions} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tổng tài khoản</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalAccounts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lớp đang theo dõi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{uniqueClassesCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vai trò khác nhau</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{uniqueRolesCount}</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Lỗi tải dữ liệu người dùng: {String(error.message || error)}
          </AlertDescription>
        </Alert>
      )}

      {!error && rows.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center">
            Chưa có tài khoản nào trong hệ thống.
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="bg-background rounded-lg border">
          <div className="px-4 py-3">
            <h2 className="text-lg font-semibold">Danh sách tài khoản gần đây</h2>
            <p className="text-muted-foreground text-sm">
              Tối đa 300 bản ghi, sắp xếp theo thời gian tạo mới nhất.
            </p>
          </div>
          <Separator />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Liên hệ</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const fullName = getUserFullName(row);
                  const phone = getUserPhone(row);
                  const className = getClassName(row, classMap);
                  const roleEntries = getUserRoles(row);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{fullName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <div>{row.email || "—"}</div>
                        {phone && <div className="text-xs">{phone}</div>}
                      </TableCell>
                      <TableCell>{className}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {roleEntries.length === 0 && <Badge variant="outline">—</Badge>}
                          {roleEntries.map((role) => (
                            <Badge key={`${row.id}-${role.role_id}`} variant="secondary">
                              {role.role_id}
                            </Badge>
                          ))}
                        </div>
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
