import getSupabaseServer from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { fetchCriteriaFromDB, fetchStudentsFromDB } from '@/lib/violations'
import { getAllowedClassIdsForView } from '@/lib/rbac'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Search = {
  classId?: string
  studentId?: string
  criteriaId?: string
  start?: string
  end?: string
}

export default async function ViolationHistoryPageContent({ searchParams }: { searchParams?: Search }) {
  // Auth + role guard (reuse CC access rule for now)
  let supabase: any
  try { supabase = await getSupabaseServer() } catch { supabase = null }
  if (!supabase) return <p className="text-sm text-red-600">Không khởi tạo được Supabase server.</p>
  const { data: userRes } = await supabase.auth.getUser()
  const authUid = userRes?.user?.id
  if (!authUid) redirect('/login')
  const { data: appUser } = await supabase.from('users').select('id').eq('auth_uid', authUid).maybeSingle()
  const appUserId = appUser?.id as string | undefined
  if (!appUserId) redirect('/login')
  const { data: roles } = await supabase.from('user_roles').select('role_id').eq('user_id', appUserId)
  const hasCC = Array.isArray(roles) && roles.some(r => r.role_id === 'CC')
  if (!hasCC) redirect('/')

  // Allowed classes for viewing (null => all)
  const allowedViewClassIds = await getAllowedClassIdsForView(supabase, appUserId)

  // Fetch classes list (respect allowed set if not null)
  let { data: classes } = await supabase.from('classes').select('id,name').order('name')
  if (allowedViewClassIds) {
    classes = (classes || []).filter((c: any) => allowedViewClassIds.has(c.id))
  }

  // Fetch students (filtered to allowed classes)
  const allStudents = await fetchStudentsFromDB(supabase)
  const students = allowedViewClassIds ? allStudents.filter(s => allowedViewClassIds.has(s.class_id)) : allStudents

  // Fetch criteria list
  const criteriaList = await fetchCriteriaFromDB(supabase)

  // Build records query with filters
  let query = supabase
    .from('records')
    .select('id, created_at, student_id, class_id, score, note, classes(id,name), criteria(id,name), users:student_id(user_profiles(full_name), user_name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (allowedViewClassIds) {
    query = query.in('class_id', Array.from(allowedViewClassIds))
  }
  if (searchParams?.classId) query = query.eq('class_id', searchParams.classId)
  if (searchParams?.studentId) query = query.eq('student_id', searchParams.studentId)
  if (searchParams?.criteriaId) query = query.eq('criteria_id', searchParams.criteriaId)
  if (searchParams?.start) {
    const startDate = new Date(searchParams.start)
    if (!isNaN(startDate.getTime())) query = query.gte('created_at', startDate.toISOString())
  }
  if (searchParams?.end) {
    const endDate = new Date(searchParams.end)
    if (!isNaN(endDate.getTime())) {
      // Add 1 day 23:59 buffer inclusive
      endDate.setHours(23,59,59,999)
      query = query.lte('created_at', endDate.toISOString())
    }
  }

  const { data: rows, error: rowsErr } = await query

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Lịch sử ghi nhận</h1>
        <p className="text-sm text-muted-foreground mt-1">Tra cứu các ghi nhận vi phạm với bộ lọc linh hoạt.</p>
      </div>

      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Lớp</label>
          <select name="classId" defaultValue={searchParams?.classId || ''} className="border rounded px-2 py-1 text-sm bg-white">
            <option value="">-- Tất cả --</option>
            {(classes || []).map((c: any) => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Học sinh</label>
            <select name="studentId" defaultValue={searchParams?.studentId || ''} className="border rounded px-2 py-1 text-sm bg-white">
              <option value="">-- Tất cả --</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name || s.user_name || s.id.slice(0,8)}</option>)}
            </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Tiêu chí</label>
          <select name="criteriaId" defaultValue={searchParams?.criteriaId || ''} className="border rounded px-2 py-1 text-sm bg-white">
            <option value="">-- Tất cả --</option>
            {criteriaList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Từ ngày</label>
          <input type="date" name="start" defaultValue={searchParams?.start || ''} className="border rounded px-2 py-1 text-sm bg-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Đến ngày</label>
          <input type="date" name="end" defaultValue={searchParams?.end || ''} className="border rounded px-2 py-1 text-sm bg-white" />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-[34px] px-3 rounded bg-indigo-600 text-white text-sm">Lọc</button>
          <Link href="/violation-history" className="h-[34px] px-3 rounded bg-zinc-200 text-zinc-800 text-sm flex items-center">Xoá lọc</Link>
        </div>
      </form>

      {rowsErr && (
        <div className="border rounded p-3 bg-red-50 text-red-700 text-sm">Lỗi truy vấn records: {String(rowsErr.message || rowsErr)}</div>
      )}

      {!rowsErr && (!rows || rows.length === 0) && (
        <p className="text-sm text-muted-foreground">Không có ghi nhận phù hợp với bộ lọc hiện tại.</p>
      )}

      {rows && rows.length > 0 && (
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
      )}
    </section>
  )
}
