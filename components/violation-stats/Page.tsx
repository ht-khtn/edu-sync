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
// file touched to ensure editors/TS server reload recognize the latest content
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
        <TabsList className="border-b bg-white">
          <TabsTrigger
            value="criteria"
            className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700"
          >
            Theo lỗi
          </TabsTrigger>
          <TabsTrigger
            value="class"
            className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700"
          >
            Theo lớp
          </TabsTrigger>
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

      {/* Lịch sử vi phạm không hiển thị ở trang thống kê (đã có trang riêng) */}
    </section>
  )
}
 
