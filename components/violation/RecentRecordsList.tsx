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
  if (!allowedWriteClassIds.size) return null

  const { data: rows } = await supabase
    .from('records')
    .select('id, created_at, score, note, classes(name), criteria(name,code), users:student_id(user_profiles(full_name))')
    .is('deleted_at', null)
    .in('class_id', Array.from(allowedWriteClassIds))
    .order('created_at', { ascending: false })
    .limit(20)

  if (!rows?.length) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Gần đây</h2>
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
                <td className="px-3 py-1.5">{r.classes?.name || '—'}</td>
                <td className="px-3 py-1.5">{r.users?.user_profiles?.full_name || '—'}</td>
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
