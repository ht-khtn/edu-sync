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
import { CreateAccountDialog } from './CreateAccountDialog'

type AdminAccountsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function AdminAccountsPage({ searchParams }: AdminAccountsPageProps) {
  const [{ supabase, appUserId }, roles] = await Promise.all([
    getServerAuthContext(),
    getServerRoles()
  ])
  
  if (!appUserId) redirect('/login')

  const summary = summarizeRoles(roles)
  if (!hasAdminManagementAccess(summary)) redirect('/admin')

  // Parallel fetch classes and users
  const [{ data: classList }, { data: users, error }] = await Promise.all([
    supabase.from('classes').select('id,name').order('name'),
    supabase
      .from('users')
      .select(
        'id, user_name, email, class_id, created_at, user_profiles(full_name,phone_number), user_roles(role_id,target,permissions(name,scope))'
      )
      .order('created_at', { ascending: false })
      .limit(300)
  ])
  
  const classOptions = (classList || []).map((c) => ({ id: c.id, name: c.name || c.id }))
  const classMap = new Map(classOptions.map((c) => [c.id, c.name]))

  const rows = Array.isArray(users) ? users : []
  const totalAccounts = rows.length
  const uniqueClasses = new Set<string>()
  rows.forEach((row) => {
    if (row.class_id) {
      uniqueClasses.add(classMap.get(row.class_id) || row.class_id)
    }
  })

  const okParam = getParam(searchParams, 'ok')
  const errParam = getParam(searchParams, 'error')

  return (
    <section className="space-y-6">
      <QueryToasts ok={okParam} error={errParam} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý tài khoản</h1>
          <p className="text-muted-foreground mt-1">Danh sách tài khoản người dùng nội bộ, chỉ hiển thị cho AD và MOD.</p>
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
            <p className="text-2xl font-semibold">{uniqueClasses.size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vai trò khác nhau</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {Array.from(
                new Set(
                  rows.flatMap((row) => {
                    const roles = Array.isArray(row.user_roles)
                      ? row.user_roles
                      : row.user_roles
                        ? [row.user_roles]
                        : []
                    return roles.map((role) => role.role_id)
                  })
                )
              ).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Lỗi tải dữ liệu người dùng: {String(error.message || error)}</AlertDescription>
        </Alert>
      )}

      {!error && rows.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Chưa có tài khoản nào trong hệ thống.</CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border bg-background">
          <div className="px-4 py-3">
            <h2 className="text-lg font-semibold">Danh sách tài khoản gần đây</h2>
            <p className="text-sm text-muted-foreground">Tối đa 300 bản ghi, sắp xếp theo thời gian tạo mới nhất.</p>
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
                  const profile = Array.isArray(row.user_profiles)
                    ? row.user_profiles[0]
                    : row.user_profiles
                  const fullName = profile?.full_name || row.user_name || '—'
                  const phone = profile?.phone_number
                  const className = row.class_id ? classMap.get(row.class_id) || row.class_id : '—'
                  const roleEntries = Array.isArray(row.user_roles)
                    ? row.user_roles
                    : row.user_roles
                      ? [row.user_roles]
                      : []
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{fullName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{row.email || '—'}</div>
                        {phone && <div className="text-xs">{phone}</div>}
                      </TableCell>
                      <TableCell>{className}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {roleEntries.length === 0 && (
                            <Badge variant="outline">—</Badge>
                          )}
                          {roleEntries.map((role) => (
                            <Badge key={`${row.id}-${role.role_id}`} variant="secondary">
                              {role.role_id}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleDateString('vi-VN')
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
