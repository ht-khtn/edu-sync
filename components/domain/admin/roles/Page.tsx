import { redirect } from 'next/navigation'
import { getServerAuthContext, getServerRoles, summarizeRoles } from '@/lib/server-auth'
import { hasAdminManagementAccess } from '@/lib/admin-access'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

export default async function AdminRolesPage() {
  const { supabase, appUserId } = await getServerAuthContext()
  if (!appUserId) redirect('/login')

  const summary = summarizeRoles(await getServerRoles())
  if (!hasAdminManagementAccess(summary)) redirect('/admin')

  const { data: roles, error } = await supabase
    .from('user_roles')
    .select(
      'id, role_id, target, created_at, users(id, user_name, email, user_profiles(full_name)), permissions(name, scope)'
    )
    .order('created_at', { ascending: false })
    .limit(300)

  const rows = Array.isArray(roles) ? roles : []

  const roleDistribution = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.role_id || 'UNKNOWN'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quản lý vai trò</h1>
        <p className="text-muted-foreground mt-1">Theo dõi gán quyền, scope và target cho từng tài khoản.</p>
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
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Lỗi tải dữ liệu vai trò: {String(error.message || error)}</AlertDescription>
        </Alert>
      )}

      {!error && rows.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Chưa có vai trò nào được gán.</CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border bg-background">
          <div className="px-4 py-3">
            <h2 className="text-lg font-semibold">Các gán quyền gần đây</h2>
            <p className="text-sm text-muted-foreground">Tối đa 300 bản ghi, sắp xếp theo thời gian.</p>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const userRef = Array.isArray(row.users) ? row.users[0] : row.users
                  const profile = Array.isArray(userRef?.user_profiles) ? userRef?.user_profiles[0] : userRef?.user_profiles
                  const fullName = profile?.full_name || userRef?.user_name || '—'
                  const email = userRef?.email
                  const permission = Array.isArray(row.permissions) ? row.permissions[0] : row.permissions
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{fullName}</div>
                        {email && <div className="text-sm text-muted-foreground">{email}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.role_id}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {permission?.scope || '—'}
                      </TableCell>
                      <TableCell>{row.target || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString('vi-VN', {
                              timeZone: 'Asia/Ho_Chi_Minh',
                            })
                          : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  )
}
