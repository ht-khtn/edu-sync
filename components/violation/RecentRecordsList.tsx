import getSupabaseServer from '@/lib/supabase-server'
import { getAllowedClassIdsForWrite } from '@/lib/rbac'

export default async function RecentRecordsList() {
  let supabase: any = null
  try { supabase = await getSupabaseServer() } catch {}
  if (!supabase) return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Ghi nhận hôm nay</h2>
      <p className="text-sm text-red-600">Không kết nối được tới Supabase (server supabase không sẵn sàng).</p>
    </section>
  )

  const { data: userRes } = await supabase.auth.getUser()
  const authUid = userRes?.user?.id
  if (!authUid) return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Ghi nhận hôm nay</h2>
      <p className="text-sm text-red-600">Không tìm thấy session đăng nhập. Vui lòng đăng nhập lại.</p>
    </section>
  )
  const { data: appUser } = await supabase.from('users').select('id').eq('auth_uid', authUid).maybeSingle()
  if (!appUser?.id) return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Ghi nhận hôm nay</h2>
      <p className="text-sm text-red-600">Không tìm thấy bản ghi người dùng ứng dụng (users). auth_uid có vẻ không map tới app user.</p>
    </section>
  )

  const allowedWriteClassIds = await getAllowedClassIdsForWrite(supabase, appUser.id)
  if (!allowedWriteClassIds || !allowedWriteClassIds.size) return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Ghi nhận hôm nay</h2>
      <p className="text-sm text-red-600">Bạn hiện không có quyền ghi nhận cho lớp nào (allowedWriteClassIds trống).</p>
      <p className="text-xs text-muted-foreground">Nếu bạn nghĩ đây là lỗi, kiểm tra bảng <code>user_roles</code> và quyền của bạn.</p>
    </section>
  )

  // Show all records for allowed classes (no date filter) so user can inspect history
  const { data: rows } = await supabase
    .from('records')
    .select('id, created_at, student_id, class_id, score, note, classes(id,name), criteria(name,code), users:student_id(user_profiles(full_name), user_name)')
    .is('deleted_at', null)
    .in('class_id', Array.from(allowedWriteClassIds))
    .order('created_at', { ascending: false })
    .limit(500)

  if (!rows?.length) return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Ghi nhận hôm nay</h2>
      <p className="text-sm text-muted-foreground">Không tìm thấy ghi nhận cho các lớp sau:</p>
      <ul className="text-xs list-disc pl-6 text-muted-foreground">
        {Array.from(allowedWriteClassIds).map((id) => <li key={id}>{id}</li>)}
      </ul>
      <p className="text-sm text-red-600">(Không có dòng trả về từ bảng records với điều kiện lọc hiện tại.)</p>
    </section>
  )

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Ghi nhận hôm nay</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-input rounded-md">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Thời gian</th>
              <th className="text-left px-3 py-2 font-medium">Lớp</th>
              <th className="text-left px-3 py-2 font-medium">Học sinh</th>
              <th className="text-left px-3 py-2 font-medium">Tiêu chí</th>
              <th className="text-left px-3 py-2 font-medium">Điểm</th>
              <th className="text-left px-3 py-2 font-medium">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="even:bg-muted/40">
                <td className="px-3 py-1.5 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-1.5">{r.classes?.name || '—'} <span className="text-xs text-muted-foreground">{r.class_id}</span></td>
                <td className="px-3 py-1.5">{(r.users?.user_profiles && Array.isArray(r.users.user_profiles) ? r.users.user_profiles[0]?.full_name : r.users?.user_profiles?.full_name) || r.users?.user_name || '—'} <span className="text-xs text-muted-foreground">{r.student_id}</span></td>
                <td className="px-3 py-1.5">{r.criteria?.code ? `${r.criteria.code} — ${r.criteria.name}` : r.criteria?.name || '—'}</td>
                <td className="px-3 py-1.5">{r.score}</td>
                <td className="px-3 py-1.5">{r.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
