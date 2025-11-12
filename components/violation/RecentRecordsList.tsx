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
    <section className="flex flex-col divide-y border rounded-md bg-white">
      {rows.map((r: any) => {
        const fullName = (r.users?.user_profiles && Array.isArray(r.users.user_profiles) ? r.users.user_profiles[0]?.full_name : r.users?.user_profiles?.full_name) || r.users?.user_name || '—'
        const criteriaLabel = r.criteria?.name || (r.criteria?.id ? `#${String(r.criteria.id).slice(0,8)}` : '—')
        return (
          <div key={r.id} className="flex items-start gap-3 px-4 py-3 group">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium truncate max-w-[200px] sm:max-w-[260px]">{fullName}</span>
                <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{criteriaLabel}</span>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</span>
              </div>
              <div className="mt-1 text-sm flex flex-wrap items-center gap-3">
                <span className="font-medium text-red-600">{r.score}</span>
                {r.note && <span className="text-muted-foreground truncate max-w-[320px]">{r.note}</span>}
              </div>
            </div>
            <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <RecordRowActions id={r.id} initialScore={r.score} initialNote={r.note} />
            </div>
          </div>
        )
      })}
    </section>
  )
}
