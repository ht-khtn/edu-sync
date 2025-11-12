import getSupabaseServer from '@/lib/supabase-server'
import { getAllowedClassIdsForWrite } from '@/lib/rbac'

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
