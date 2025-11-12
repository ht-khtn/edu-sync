import getSupabaseServer from '@/lib/supabase-server'
import { getAllowedClassIdsForWrite } from '@/lib/rbac'
import RecordRowActions from './RecordRowActions'

export default async function RecentRecordsList() {
  let supabase: any = null
  try { supabase = await getSupabaseServer() } catch {}
  if (!supabase) return null

  const { data: userRes } = await supabase.auth.getUser()
  const authUid = userRes?.user?.id
  if (!authUid) return null
  const { data: appUser } = await supabase.from('users').select('id').eq('auth_uid', authUid).maybeSingle()
  if (!appUser?.id) return null

  const allowedWriteClassIds = await getAllowedClassIdsForWrite(supabase, appUser.id)
  if (!allowedWriteClassIds || !allowedWriteClassIds.size) return null

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

  if (rowsErr) return null

  if (!rows?.length) return null

  return (
    <section className="flex flex-col">
      {rows.map((r: any) => {
        const fullName = (r.users?.user_profiles && Array.isArray(r.users.user_profiles) ? r.users.user_profiles[0]?.full_name : r.users?.user_profiles?.full_name) || r.users?.user_name || '—'
        const criteriaLabel = r.criteria?.name || (r.criteria?.id ? `#${String(r.criteria.id).slice(0,8)}` : '—')
        // format time in Asia/Ho_Chi_Minh (UTC+7)
        const created = new Date(r.created_at)
        const timeStr = created.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
        const dateStr = created.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        return (
          <div key={r.id} className="bg-white rounded-lg p-3 mb-3 shadow-sm flex items-center gap-4">
            <div className="w-16 text-sm font-medium text-red-600 text-right">{r.score}</div>
            <div className="flex-1 min-w-0 grid grid-cols-[1fr,1fr,120px] gap-4 items-center">
              <div className="truncate text-sm font-semibold text-foreground">{criteriaLabel}</div>
              <div className="truncate text-sm text-muted-foreground">{fullName}</div>
              <div className="text-xs text-muted-foreground text-right tabular-nums">{dateStr} {timeStr}</div>
            </div>
            <div className="flex-none">
              <RecordRowActions id={r.id} initialScore={r.score} initialNote={r.note} initialStudentId={r.student_id} initialCriteriaId={r.criteria?.id} classId={r.class_id} />
            </div>
          </div>
        )
      })}
    </section>
  )
}
