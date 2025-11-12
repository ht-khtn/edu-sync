import getSupabaseServer from '@/lib/supabase-server'
import { getAllowedClassIdsForWrite } from '@/lib/rbac'

export default async function RecentRecordsList() {
  let supabase: any = null
  try { supabase = await getSupabaseServer() } catch {}
  if (!supabase) return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-red-600">Không kết nối được tới Supabase (server supabase không sẵn sàng).</p>
    </section>
  )

  const { data: userRes } = await supabase.auth.getUser()
  const authUid = userRes?.user?.id
  if (!authUid) return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-red-600">Không tìm thấy session đăng nhập. Vui lòng đăng nhập lại.</p>
    </section>
  )
  const { data: appUser } = await supabase.from('users').select('id').eq('auth_uid', authUid).maybeSingle()
  if (!appUser?.id) return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-red-600">Không tìm thấy bản ghi người dùng ứng dụng (users). auth_uid có vẻ không map tới app user.</p>
    </section>
  )

  const allowedWriteClassIds = await getAllowedClassIdsForWrite(supabase, appUser.id)
  if (!allowedWriteClassIds || !allowedWriteClassIds.size) return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-red-600">Bạn hiện không có quyền ghi nhận cho lớp nào (allowedWriteClassIds trống).</p>
      <p className="text-xs text-muted-foreground">Nếu bạn nghĩ đây là lỗi, kiểm tra bảng <code>user_roles</code> và quyền của bạn.</p>
    </section>
  )

  // Filter to records from start of today
  const startOfDay = new Date(); startOfDay.setHours(0,0,0,0)
  const startIso = startOfDay.toISOString()
  const { data: rows, error: rowsErr } = await supabase
    .from('records')
    .select('id, created_at, student_id, class_id, score, note, classes(id,name), criteria(name,id), users:student_id(user_profiles(full_name), user_name)')
  .is('deleted_at', null)
  .in('class_id', Array.from(allowedWriteClassIds))
  .gte('created_at', startIso)
  .order('created_at', { ascending: false })
  .limit(200)

  if (rowsErr) {
    // attempt a lightweight debug query to help diagnose DB/RLS issues
    const { data: debugRows, error: debugErr } = await supabase
      .from('records')
      .select('id,class_id,student_id,created_at')
      .limit(10)
    return (
      <section className="flex flex-col gap-3">
        <p className="text-sm text-red-600">Lỗi khi truy vấn records: {String(rowsErr.message || rowsErr)}.</p>
        {debugErr ? (
          <p className="text-sm text-red-600">Lỗi debug: {String(debugErr.message || debugErr)}</p>
        ) : (
          <div>
            <p className="text-sm">Một số dòng (debug):</p>
            <ul className="text-xs list-disc pl-6 text-muted-foreground">
              {(debugRows || []).map((r: any) => <li key={r.id}>{r.id} — class_id: {r.class_id} — student_id: {r.student_id} — {r.created_at}</li>)}
            </ul>
          </div>
        )}
      </section>
    )
  }

  if (!rows?.length) return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Không tìm thấy ghi nhận cho các lớp sau:</p>
      <ul className="text-xs list-disc pl-6 text-muted-foreground">
        {Array.from(allowedWriteClassIds).map((id) => <li key={id}>{id}</li>)}
      </ul>
      <p className="text-sm text-red-600">(Không có dòng trả về từ bảng records với điều kiện lọc hiện tại.)</p>
    </section>
  )

  return (
    <section className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r: any) => {
          const fullName = (r.users?.user_profiles && Array.isArray(r.users.user_profiles) ? r.users.user_profiles[0]?.full_name : r.users?.user_profiles?.full_name) || r.users?.user_name || '—'
          return (
            <div key={r.id} className="border rounded-md p-3 shadow-sm bg-white">
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              <div className="mt-1 font-medium">{fullName}</div>
              <div className="text-sm">{r.criteria?.name || (r.criteria?.id ? `#${String(r.criteria.id).slice(0,8)}` : '—')}</div>
              <div className="mt-1 text-sm"><span className="font-medium">Điểm:</span> {r.score}</div>
              {r.note ? <div className="mt-1 text-sm text-muted-foreground">{r.note}</div> : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
