import getSupabaseServer from '@/lib/supabase-server'
// import { redirect } from 'next/navigation'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'

export const dynamic = 'force-dynamic'

export default async function MyViolationsPageContent() {
  let supabase: Awaited<ReturnType<typeof getSupabaseServer>> | null
  try { supabase = await getSupabaseServer() } catch { supabase = null }
  if (!supabase) return <p className="text-sm text-red-600">Không khởi tạo được Supabase server.</p>

  // Auth
  // const { data: userRes } = await supabase.auth.getUser()
  // const authUid = userRes?.user?.id
  // if (!authUid) redirect('/login')
  // const { data: appUser } = await supabase.from('users').select('id').eq('auth_uid', authUid).maybeSingle()
  // const appUserId = appUser?.id as string | undefined
  // if (!appUserId) redirect('/login')

  // // Role gate: allow only S, CC, or YUM
  // const { data: roles } = await supabase.from('user_roles').select('role_id').eq('user_id', appUserId)
  // const roleList = Array.isArray(roles) ? roles : []
  // const allowed = roleList.some((r) => r.role_id === 'S' || r.role_id === 'YUM' || r.role_id === 'CC')
  // if (!allowed) redirect('/')

  const appUserId = 'mock-user-id' // Mock for development

  // Fetch own violations
  const { data: rows, error: rowsErr } = await supabase
    .from('records')
    .select('id, created_at, score, note, criteria(id,name), classes(id,name)')
    .eq('student_id', appUserId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(300)

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Vi phạm của tôi</h1>
        <p className="text-sm text-muted-foreground mt-1">Danh sách các ghi nhận vi phạm gắn với tài khoản của bạn.</p>
      </div>

      {rowsErr && (
        <div className="border rounded p-3 bg-red-50 text-red-700 text-sm">Lỗi truy vấn: {String(rowsErr.message || rowsErr)}</div>
      )}

      {!rowsErr && (!rows || rows.length === 0) && (
        <p className="text-sm text-muted-foreground">Bạn chưa có ghi nhận vi phạm nào.</p>
      )}

      {rows && rows.length > 0 && (
        <div className="border rounded-md bg-white p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead>Tiêu chí</TableHead>
                <TableHead>Điểm</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const classEntry = Array.isArray(r.classes) ? r.classes[0] : r.classes
                const criteriaEntry = Array.isArray(r.criteria) ? r.criteria[0] : r.criteria
                return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</TableCell>
                  <TableCell className="text-sm">{classEntry?.name || '—'}</TableCell>
                  <TableCell className="text-sm">{criteriaEntry?.name || '—'}</TableCell>
                  <TableCell className="text-sm font-medium">{r.score}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-60 truncate" title={r.note}>{r.note || '—'}</TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
