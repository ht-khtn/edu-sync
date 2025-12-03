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
import QueryToasts from '@/components/common/QueryToasts'
import { AssignRoleDialog } from './AssignRoleDialog'

type AdminRolesPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function AdminRolesPage({ searchParams }: AdminRolesPageProps) {
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

  const { data: userOptions } = await supabase
    .from('users')
    .select('id, user_name, email, class_id, user_profiles(full_name)')
    .order('user_name', { ascending: true })
    .limit(500)

  const { data: classList } = await supabase
    .from('classes')
    .select('id, name')
    .order('name', { ascending: true })

  const classMap = new Map<string, string>()
  for (const cls of classList || []) {
    if (cls?.id) classMap.set(cls.id, cls.name || cls.id)
  }

  const { data: permissionList } = await supabase
    .from('permissions')
    .select('id, name')
    .order('id', { ascending: true })

  const okParam = getParam(searchParams, 'ok')
  const errParam = getParam(searchParams, 'error')

  return (
    <section className="space-y-6">
      <QueryToasts ok={okParam} error={errParam} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý vai trò</h1>
          <p className="text-muted-foreground mt-1">Theo dõi gán quyền, scope và target cho từng tài khoản.</p>
        </div>
        <AssignRoleDialog
          users={(userOptions || []).map((u) => {
            const profile = Array.isArray(u.user_profiles) ? u.user_profiles[0] : u.user_profiles
            const className = (u.class_id && classMap.get(u.class_id)) || u.class_id || 'Chưa gán'
            const displayName = profile?.full_name?.trim() || u.user_name || u.email || u.id
            return {
              id: u.id,
              label: `${className} - ${displayName}`,
              description: u.email || u.user_name || undefined,
            }
          })}
          roles={(permissionList || []).map((p) => ({ id: p.id, name: p.name || p.id }))}
        />
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

function getParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const raw = searchParams?.[key]
  if (Array.isArray(raw)) return raw[0]
  return raw
}
