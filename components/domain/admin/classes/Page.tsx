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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import QueryToasts from '@/components/common/QueryToasts'
import { CreateClassDialog } from './CreateClassDialog'
import { UpdateHomeroomDialog } from './UpdateHomeroomDialog'

type AdminClassesPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function AdminClassesPage({ searchParams }: AdminClassesPageProps) {
  const { supabase, appUserId } = await getServerAuthContext()
  if (!appUserId) redirect('/login')

  const summary = summarizeRoles(await getServerRoles())
  if (!hasAdminManagementAccess(summary)) redirect('/admin')

  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, name, grade_id, grades(name), homeroom_teacher_id, created_at')
    .order('name', { ascending: true })

  const classRows = Array.isArray(classes) ? classes : []
  const homeroomIds = Array.from(
    new Set(
      classRows
        .map((row) => row.homeroom_teacher_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  )

  const teacherMap = new Map<string, { name: string; short: string }>()
  if (homeroomIds.length > 0) {
    const { data: teachers } = await supabase
      .from('users')
      .select('id, user_name, user_profiles(full_name)')
      .in('id', homeroomIds)

    for (const teacher of teachers || []) {
      if (!teacher?.id) continue
      const profile = Array.isArray(teacher.user_profiles) ? teacher.user_profiles[0] : teacher.user_profiles
      const fullName = profile?.full_name || teacher.user_name || '—'
      teacherMap.set(teacher.id, {
        name: fullName,
        short: fullName.split(' ').slice(-1).join('') || fullName,
      })
    }
  }

  const gradeSet = new Set<string>()
  classRows.forEach((row) => {
    const grade = Array.isArray(row.grades) ? row.grades[0] : row.grades
    if (grade?.name) gradeSet.add(grade.name)
  })

  const { data: gradeList } = await supabase.from('grades').select('id,name').order('name')

  const { data: teacherOptions } = await supabase
    .from('users')
    .select('id, user_name, email')
    .order('user_name', { ascending: true })
    .limit(500)

  const okParam = getParam(searchParams, 'ok')
  const errParam = getParam(searchParams, 'error')

  return (
    <section className="space-y-6">
      <QueryToasts ok={okParam} error={errParam} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý lớp học</h1>
          <p className="text-muted-foreground mt-1">Tổng quan danh sách lớp, khối và giáo viên chủ nhiệm.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreateClassDialog
            grades={(gradeList || []).map((g) => ({ id: g.id, name: g.name || g.id }))}
            teachers={(teacherOptions || []).map((t) => ({ id: t.id, label: t.user_name || t.email || t.id }))}
          />
          <UpdateHomeroomDialog
            classes={classRows.map((cls) => ({ id: cls.id, name: cls.name || cls.id }))}
            teachers={(teacherOptions || []).map((t) => ({ id: t.id, label: t.user_name || t.email || t.id }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tổng số lớp</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{classRows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Số khối</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{gradeSet.size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GVCN đã gán</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{teacherMap.size}</p>
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
          <CardContent className="py-8 text-center text-muted-foreground">Chưa có lớp nào trong hệ thống.</CardContent>
        </Card>
      )}

      {classRows.length > 0 && (
        <div className="rounded-lg border bg-background">
          <div className="px-4 py-3">
            <h2 className="text-lg font-semibold">Danh sách lớp</h2>
            <p className="text-sm text-muted-foreground">Sắp xếp theo tên lớp.</p>
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
                  const grade = Array.isArray(row.grades) ? row.grades[0] : row.grades
                  const teacher = row.homeroom_teacher_id
                    ? teacherMap.get(row.homeroom_teacher_id)
                    : undefined
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name || row.id}</TableCell>
                      <TableCell>{grade?.name || '—'}</TableCell>
                      <TableCell>
                        {teacher?.name ? (
                          <span>{teacher.name}</span>
                        ) : (
                          <span className="text-muted-foreground">Chưa gán</span>
                        )}
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
