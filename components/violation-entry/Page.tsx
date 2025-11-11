import { ViolationForm } from '@/components/violation/ViolationForm'
import RecentRecordsList from '@/components/violation/RecentRecordsList'
import { fetchCriteriaFromDB, fetchStudentsFromDB, filterStudentsByClass, type Criteria, type Student } from '@/lib/violations'
import getSupabase from '@/lib/supabase'
import getSupabaseServer from '@/lib/supabase-server'
import { getAllowedClassIdsForWrite } from '@/lib/rbac'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function ViolationEntryPageContent({ searchParams }: { searchParams?: { ok?: string, error?: string } }) {
  let supabaseClient: any = null
  let supabaseServer: any = null
  try {
    ;[supabaseClient, supabaseServer] = await Promise.all([getSupabase(), getSupabaseServer()])
  } catch {
    // Supabase env not configured, allow graceful fallback
  }
  let criteria: Criteria[] = []
  let students: Student[] = []
  if (supabaseClient) {
    ;[criteria, students] = await Promise.all([
      fetchCriteriaFromDB(supabaseClient),
      fetchStudentsFromDB(supabaseClient),
    ])
  }

  // Server-side auth-based filtering: map auth user -> app user id -> roles/classes
  let effectiveStudents = students
  let allowedClasses: { id: string; name: string }[] = []
  let currentClass: { id: string; name: string } | null = null
  try {
    if (supabaseServer) {
      const { data: userRes } = await supabaseServer.auth.getUser()
      const authUid = userRes?.user?.id
      if (authUid) {
        const { data: appUser } = await supabaseServer
          .from('users')
          .select('id')
          .eq('auth_uid', authUid)
          .maybeSingle()
        const appUserId = appUser?.id
        if (appUserId) {
          // Fetch roles and all classes
          const [{ data: roles }, { data: classes }] = await Promise.all([
            supabaseServer.from('user_roles').select('role_id,target').eq('user_id', appUserId),
            supabaseServer.from('classes').select('id,name')
          ])

          const classMap = new Map<string, string>()
          for (const c of classes || []) classMap.set(c.id, c.name)

          // If user is a CC with a single target (target stores class name), set currentClass
          const classTargets = (roles || [])
            .filter((r: any) => r.role_id === 'CC' && r.target)
            .map((r: any) => String(r.target))
          if (classTargets.length === 1) {
            const targetName = classTargets[0]
            const match = (classes || []).find((c: any) => c.name === targetName)
            if (match?.id) {
              currentClass = { id: match.id, name: match.name }
            }
          }

          // Determine which class ids the user may write to
          const allowedSet = await getAllowedClassIdsForWrite(supabaseServer, appUserId)

          // Build allowedClasses list (for client select)
          if (allowedSet === null) {
            // all classes allowed
            for (const c of classes || []) allowedClasses.push({ id: c.id, name: c.name })
          } else {
            for (const id of Array.from(allowedSet || [])) {
              const name = classMap.get(id) ?? id
              allowedClasses.push({ id, name })
            }
          }

          // Prefer fetching students server-side with RLS using allowed classes
          try {
            let usersQuery = supabaseServer.from('users')
              .select('id,class_id,user_profiles(full_name,email)')
            if (currentClass?.id) {
              usersQuery = usersQuery.eq('class_id', currentClass.id)
            } else if (allowedSet && allowedSet.size > 0) {
              usersQuery = usersQuery.in('class_id', Array.from(allowedSet))
            }
            const { data: usersData, error: usersErr } = await usersQuery
            if (!usersErr && Array.isArray(usersData)) {
              const serverStudents: Student[] = (usersData as any[]).map((u: any) => ({
                id: u.id,
                student_code: u.user_profiles?.[0]?.email ?? String(u.id).slice(0, 8),
                full_name: u.user_profiles?.[0]?.full_name ?? 'Chưa cập nhật',
                class_id: u.class_id,
                class_name: classMap.get(u.class_id) ?? '',
              }))
              effectiveStudents = serverStudents
            }
          } catch {}

          // Fallback to client-fetched students if server fetch failed or returned empty
          if (!effectiveStudents?.length) {
            const studentsWithClass = students.map((s) => ({ ...s, class_name: classMap.get(s.class_id) ?? '' }))
            if (currentClass) {
              effectiveStudents = studentsWithClass.filter(s => s.class_id === currentClass?.id)
              allowedClasses = [{ id: currentClass.id, name: currentClass.name }]
            } else if (allowedSet === null) {
              effectiveStudents = studentsWithClass
            } else {
              const allowedIds = new Set(Array.from(allowedSet || []))
              effectiveStudents = studentsWithClass.filter(s => allowedIds.has(s.class_id))
            }
          }
        }
      }
    }
  } catch (e) {
    // ignore filtering on error
  }

  return (
    <main className="mx-auto max-w-6xl p-6 flex flex-col gap-8">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Nhập lỗi vi phạm</CardTitle>
          <CardDescription>Danh sách tiêu chí lấy trực tiếp từ bảng criteria.</CardDescription>
        </CardHeader>
        <CardContent>
          {supabaseClient ? (
            <ViolationForm students={effectiveStudents} criteria={criteria} allowedClasses={allowedClasses} currentClass={currentClass} />
          ) : (
            <p className="text-sm text-red-600">Supabase chưa được cấu hình. Thiếu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Gần đây</CardTitle>
          <CardDescription>20 ghi nhận gần nhất trong phạm vi quyền của bạn.</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentRecordsList />
        </CardContent>
      </Card>
    </main>
  )
}
