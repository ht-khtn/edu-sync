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
          // Determine which class ids the user may write to
          const allowedSet = await getAllowedClassIdsForWrite(supabaseServer, appUserId)

          // Fetch class names to map ids -> names
          const { data: classes } = await supabaseServer.from('classes').select('id,name')
          const classMap = new Map<string, string>()
          for (const c of classes || []) classMap.set(c.id, c.name)

          // Build allowedClasses list (for client select)
          if (allowedSet && allowedSet.size > 0) {
            for (const id of allowedSet) {
              const name = classMap.get(id) ?? id
              allowedClasses.push({ id, name })
            }
          } else if (allowedSet && allowedSet.size === 0) {
            // no classes allowed -> empty list
            allowedClasses = []
          } else {
            // allowedSet could be null which means all classes allowed
            for (const c of classes || []) allowedClasses.push({ id: c.id, name: c.name })
          }

          // Attach class_name to students and filter by allowedSet
          const studentsWithClass = students.map((s) => ({ ...s, class_name: classMap.get(s.class_id) ?? '' }))
          if (allowedSet === null) {
            effectiveStudents = studentsWithClass
          } else {
            const allowedIds = new Set(Array.from(allowedSet))
            effectiveStudents = studentsWithClass.filter(s => allowedIds.has(s.class_id))
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
            <ViolationForm students={effectiveStudents} criteria={criteria} allowedClasses={allowedClasses} />
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
