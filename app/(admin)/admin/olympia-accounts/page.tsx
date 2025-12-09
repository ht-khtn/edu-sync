import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerAuthContext, getServerRoles, summarizeRoles } from '@/lib/server-auth'
import { hasAdminManagementAccess } from '@/lib/admin-access'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import OlympiaAdminForm from './OlympiaAdminForm'

const formatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })

type ParticipantRow = {
  user_id: string
  contestant_code: string | null
  role: string | null
  created_at: string | null
}

type UserRow = {
  id: string
  user_name: string | null
  email: string | null
  class_id: string | null
  user_profiles: null | { full_name: string | null } | Array<{ full_name: string | null }>
}

export const revalidate = 30

export default async function OlympiaAdminAccountsSystemPage() {
  const [{ supabase, appUserId }, roles] = await Promise.all([getServerAuthContext(), getServerRoles()])
  if (!appUserId) {
    redirect('/login')
  }

  const summary = summarizeRoles(roles)
  if (!hasAdminManagementAccess(summary)) {
    redirect('/admin')
  }

  const olympia = supabase.schema('olympia')
  const { data: participants, error } = await olympia
    .from('participants')
    .select('user_id, contestant_code, role, created_at')
    .eq('role', 'AD')
    .order('created_at', { ascending: false })
    .limit(200)

  const rows: ParticipantRow[] = participants ?? []
  const userIds = rows.map((row) => row.user_id)
  const usersMap = new Map<string, UserRow>()

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, user_name, email, class_id, user_profiles(full_name)')
      .in('id', userIds)
    for (const user of users ?? []) {
      usersMap.set(user.id, user)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Olympia</p>
          <h1 className="text-3xl font-semibold tracking-tight">Quản trị viên Olympia</h1>
          <p className="text-sm text-muted-foreground">
            Trang này tồn tại trong portal chung để bạn cấp quyền ban tổ chức trước khi họ truy cập cổng Olympia.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/olympia/admin/accounts?role=contestant">Quản lý thí sinh</Link>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Thêm admin
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">Cấp quyền Admin Olympia</DialogTitle>
                <DialogDescription>
                  Chọn người dùng để cấp quyền quản trị viên Olympia
                </DialogDescription>
              </DialogHeader>
              <OlympiaAdminForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tổng admin Olympia</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{rows.length}</p>
            <p className="text-xs text-muted-foreground">Tối đa 200 bản ghi gần nhất.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Có mã thí sinh</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{rows.filter((row) => row.contestant_code).length}</p>
            <p className="text-xs text-muted-foreground">Cho phép admin vừa là thí sinh.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Đang hoạt động</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{rows.filter((row) => !!row.created_at).length}</p>
            <p className="text-xs text-muted-foreground">Dựa trên ngày tạo bản ghi participants.</p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>Không thể tải danh sách admin Olympia: {error.message}</AlertDescription>
        </Alert>
      ) : null}

      {rows.length === 0 && !error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Chưa có tài khoản nào được gán quyền Olympia (AD).
          </CardContent>
        </Card>
      ) : null}

      {rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Danh sách chi tiết</CardTitle>
            <p className="text-xs text-muted-foreground">Bao gồm thông tin từ bảng users để phân quyền nhanh.</p>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Liên hệ</TableHead>
                  <TableHead>Mã nội bộ</TableHead>
                  <TableHead>Ngày thêm</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const user = usersMap.get(row.user_id)
                  const fullName = resolveFullName(user)
                  return (
                    <TableRow key={row.user_id}>
                      <TableCell>
                        <div className="font-medium">{fullName}</div>
                        <div className="text-xs text-muted-foreground">{user?.class_id ?? '—'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">{user?.email ?? '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="secondary">{row.contestant_code ?? '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.created_at ? formatter.format(new Date(row.created_at)) : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : null}
    </section>
  )
}

function resolveFullName(user: UserRow | undefined) {
  if (!user) return '—'
  const profiles = user.user_profiles
  if (Array.isArray(profiles)) return profiles[0]?.full_name ?? user.user_name ?? '—'
  return profiles?.full_name ?? user.user_name ?? '—'
}
