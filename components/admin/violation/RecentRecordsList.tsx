import getSupabaseServer from '@/lib/supabase-server'
import { getAllowedClassIdsForWrite } from '@/lib/rbac'
import RecordRowActions from './RecordRowActions'

type RecentRecordRow = {
  id: string
  created_at: string
  student_id: string | null
  class_id: string | null
  score: number | null
  note: string | null
  classes:
    | { id: string; name: string | null }
    | { id: string; name: string | null }[]
    | null
  criteria:
    | { id: string | number; name: string | null }
    | { id: string | number; name: string | null }[]
    | null
  users:
    | {
        user_profiles:
          | { full_name: string | null }[]
          | { full_name: string | null }
          | null
        user_name: string | null
      }
    | {
        user_profiles:
          | { full_name: string | null }[]
          | { full_name: string | null }
          | null
        user_name: string | null
      }[]
    | null
}

export default async function RecentRecordsList() {
  let supabase: Awaited<ReturnType<typeof getSupabaseServer>> | null = null
  try {
    supabase = await getSupabaseServer()
  } catch {}
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
  // Parallelize records fetch with simpler query (limit 50 for faster initial load)
  const { data: rows, error: rowsErr } = await supabase
    .from('records')
    .select('id, created_at, student_id, class_id, score, note, classes(id,name), criteria(name,id), users:student_id(user_profiles(full_name), user_name)')
  .is('deleted_at', null)
  .in('class_id', Array.from(allowedWriteClassIds))
  .gte('created_at', startIso)
  .order('created_at', { ascending: false })
  .limit(50)

  if (rowsErr) return null

  if (!rows?.length) return null

  const typedRows = (rows || []) as RecentRecordRow[]

  return (
    <section className="flex flex-col">
      {typedRows.map((r) => {
        const criteriaEntry = Array.isArray(r.criteria) ? r.criteria[0] : r.criteria
        const userEntry = Array.isArray(r.users) ? r.users[0] : r.users
        const profileEntry = Array.isArray(userEntry?.user_profiles)
          ? userEntry?.user_profiles[0]
          : userEntry?.user_profiles
        const fullName =
          profileEntry?.full_name ||
          userEntry?.user_name ||
          '—'
        const criteriaLabel =
          criteriaEntry?.name ||
          (criteriaEntry?.id ? `#${String(criteriaEntry.id).slice(0, 8)}` : '—')
        // format time in Asia/Ho_Chi_Minh (UTC+7)
        const created = new Date(r.created_at)
        const timeStr = created.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
        const dateStr = created.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        return (
          <div key={r.id} className="bg-white rounded-lg p-3 mb-3 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-16 text-sm font-medium text-red-600 text-right flex-shrink-0">{r.score}</div>
              <div className="flex-1 min-w-0 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{criteriaLabel}</div>
                </div>
                <div className="w-64 truncate text-sm text-muted-foreground">{fullName}</div>
                <div className="w-40 text-xs text-muted-foreground text-right tabular-nums">{dateStr} {timeStr}</div>
              </div>
              <div className="flex-none ml-2">
                <RecordRowActions
                  id={r.id}
                  initialNote={r.note ?? undefined}
                  initialStudentId={r.student_id ?? undefined}
                  initialCriteriaId={criteriaEntry?.id ? String(criteriaEntry.id) : undefined}
                  classId={r.class_id ?? undefined}
                />
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}
