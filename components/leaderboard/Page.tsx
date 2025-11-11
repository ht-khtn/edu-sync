import getSupabaseServer from '@/lib/supabase-server'
import { getUserRolesWithScope, getAllowedClassIdsForView } from '@/lib/rbac'

type ClassScore = {
  class_id: string
  class_name: string
  total_score: number
}

export const dynamic = 'force-dynamic'

export default async function LeaderboardPageContent() {
  let supabase: any = null
  try { supabase = await getSupabaseServer() } catch {}
  if (!supabase) {
    return <main className="max-w-4xl mx-auto p-6"><p className="text-sm text-red-600">Supabase chưa được cấu hình.</p></main>
  }

  // Get auth user
  const { data: userRes } = await supabase.auth.getUser()
  const authUid = userRes?.user?.id
  let appUserId: string | null = null
  if (authUid) {
    const { data: appUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', authUid)
      .maybeSingle()
    appUserId = appUser?.id ?? null
  }

  let roles = [] as any[]
  if (appUserId) {
    roles = await getUserRolesWithScope(supabase, appUserId)
  }

  // Determine view permission: null means all classes allowed
  const allowedClassIds = appUserId ? await getAllowedClassIdsForView(supabase, appUserId) : new Set<string>()

  // Aggregate scores per class (excluding soft deleted records)
  const { data: raw } = await supabase
    .from('records')
    .select('class_id,score,classes(name)')
    .is('deleted_at', null)

  const map = new Map<string, ClassScore>()
  for (const row of raw || []) {
    const cid = row.class_id
    if (!cid) continue
    if (allowedClassIds && allowedClassIds.size && !allowedClassIds.has(cid)) continue
    const existing = map.get(cid) || { class_id: cid, class_name: row.classes?.name || '—', total_score: 0 }
    existing.total_score += row.score || 0
    map.set(cid, existing)
  }

  const data = Array.from(map.values()).sort((a, b) => b.total_score - a.total_score)

  return (
    <main className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
      <div className="grid gap-6">
        <div className="rounded-xl border shadow-sm bg-card text-card-foreground">
          <div className="px-6 py-6 border-b">
            <h1 className="text-2xl font-semibold">Bảng xếp hạng thi đua</h1>
            <p className="text-sm text-muted-foreground">Tổng điểm theo lớp (đã trừ vi phạm, cộng hoạt động). Cập nhật thời gian thực.</p>
          </div>
          <div className="px-6 py-4 overflow-x-auto">
            <table className="w-full text-sm border border-input rounded-md">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">Lớp</th>
                  <th className="text-left px-3 py-2 font-medium">Điểm</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={row.class_id} className="even:bg-muted/40">
                    <td className="px-3 py-1.5">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium">{row.class_name}</td>
                    <td className="px-3 py-1.5">{row.total_score}</td>
                  </tr>
                ))}
                {!data.length && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">Chưa có dữ liệu.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
