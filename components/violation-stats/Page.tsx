import getSupabaseServer from '@/lib/supabase-server'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type RecordRow = {
  score: number
  criteria: { id: string; name: string | null } | null
  class_id: string
  classes: { name: string | null } | null
}

export default async function ViolationStatsPageContent() {
  const supabase = await getSupabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  const authUid = userRes?.user?.id
  if (!authUid) redirect('/login')
  const { data: appUser } = await supabase.from('users').select('id').eq('auth_uid', authUid).maybeSingle()
  const appUserId = appUser?.id as string | undefined
  if (!appUserId) redirect('/login')

  // Require at least one role with permissions.scope = 'school'
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role_id, permissions(scope)')
    .eq('user_id', appUserId)

  const hasSchoolScope = Array.isArray(roles) && roles.some((r: any) => r?.permissions?.scope === 'school')
  if (!hasSchoolScope) redirect('/')

  // Fetch minimal record fields for aggregation; exclude soft-deleted
  const { data: recs, error } = await supabase
    .from('records')
    .select('score, criteria(id,name), class_id, classes(name)')
    .is('deleted_at', null)
    .limit(20000)

  if (error) {
    return <div className="text-sm text-red-600">Lỗi truy vấn dữ liệu: {String(error.message || error)}</div>
  }

  const rows: RecordRow[] = (recs || []) as any

  // Aggregate by criteria
  const byCriteria = new Map<string, { name: string; total: number; count: number }>()
  for (const r of rows) {
    const key = r.criteria?.id || 'unknown'
    const name = r.criteria?.name || `#${String(key).slice(0, 6)}`
    const m = byCriteria.get(key) || { name, total: 0, count: 0 }
    m.total += Number(r.score || 0)
    m.count += 1
    byCriteria.set(key, m)
  }
  const criteriaAgg = Array.from(byCriteria.entries()).map(([id, v]) => ({ id, ...v }))
  criteriaAgg.sort((a, b) => b.total - a.total)

  // Aggregate by class
  const byClass = new Map<string, { name: string; total: number; count: number }>()
  for (const r of rows) {
    const key = r.class_id
    const name = r.classes?.name || r.class_id
    const m = byClass.get(key) || { name, total: 0, count: 0 }
    m.total += Number(r.score || 0)
    m.count += 1
    byClass.set(key, m)
  }
  const classAgg = Array.from(byClass.entries()).map(([id, v]) => ({ id, ...v }))
  classAgg.sort((a, b) => b.total - a.total)

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Thống kê vi phạm</h1>
        <p className="text-sm text-muted-foreground mt-1">Tổng quan theo toàn bộ dữ liệu (chỉ dành cho người dùng phạm vi trường).</p>
      </div>

      <Tabs defaultValue="criteria" className="w-full">
        <TabsList>
          <TabsTrigger value="criteria">Theo lỗi</TabsTrigger>
          <TabsTrigger value="class">Theo lớp</TabsTrigger>
        </TabsList>

        <TabsContent value="criteria" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tổng hợp theo lỗi vi phạm</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lỗi</TableHead>
                      <TableHead className="text-right">Số lần</TableHead>
                      <TableHead className="text-right">Tổng điểm</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criteriaAgg.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">{c.count}</TableCell>
                        <TableCell className="text-right">{c.total}</TableCell>
                      </TableRow>
                    ))}
                    {criteriaAgg.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-sm text-muted-foreground">Không có dữ liệu.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="class" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tổng hợp theo lớp</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lớp</TableHead>
                      <TableHead className="text-right">Số lần</TableHead>
                      <TableHead className="text-right">Tổng điểm</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classAgg.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">{c.count}</TableCell>
                        <TableCell className="text-right">{c.total}</TableCell>
                      </TableRow>
                    ))}
                    {classAgg.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-sm text-muted-foreground">Không có dữ liệu.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Full history table (all records) */}
      <div className="pt-2">
        <AllHistoryTable />
      </div>
    </section>
  )
}

async function AllHistoryTable() {
  // Reuse the same query as history but without filters and larger limit
  const supabase = await getSupabaseServer()
  const { data: rows, error } = await supabase
    .from('records')
    .select('id, created_at, student_id, class_id, score, note, classes(id,name), criteria(id,name), users:student_id(user_profiles(full_name), user_name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return <div className="text-sm text-red-600">Lỗi tải lịch sử: {String(error.message || error)}</div>
  if (!rows || rows.length === 0) return <p className="text-sm text-muted-foreground">Không có ghi nhận.</p>

  return (
    <div className="border rounded-md bg-white p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Lớp</TableHead>
            <TableHead>Học sinh</TableHead>
            <TableHead>Tiêu chí</TableHead>
            <TableHead>Điểm</TableHead>
            <TableHead>Ghi chú</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r: any) => {
            const fullName = (r.users?.user_profiles && Array.isArray(r.users.user_profiles) ? r.users.user_profiles[0]?.full_name : r.users?.user_profiles?.full_name) || r.users?.user_name || '—'
            return (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-sm">{r.classes?.name || r.class_id}</TableCell>
                <TableCell className="text-sm">{fullName}</TableCell>
                <TableCell className="text-sm">{r.criteria?.name || (r.criteria?.id ? `#${String(r.criteria.id).slice(0,8)}` : '—')}</TableCell>
                <TableCell className="text-sm font-medium">{r.score}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate" title={r.note}>{r.note || '—'}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
