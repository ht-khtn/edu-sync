import { ViolationForm } from '@/components/violation/ViolationForm'
import { fetchCriteriaFromDB, fetchStudentsFromDB, filterStudentsByClass, type Criteria, type Student } from '@/lib/violations'
import getSupabase from '@/lib/supabase'
import getSupabaseServer from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function ViolationEntryPageContent({ searchParams }: { searchParams?: { ok?: string } }) {
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
          const [{ data: roles }] = await Promise.all([
            supabaseServer.from('user_roles').select('role_id,target').eq('user_id', appUserId),
          ])
          const classTargets = (roles || [])
            .filter((r: any) => r.role_id === 'CC' && r.target)
            .map((r: any) => String(r.target))
          effectiveStudents = filterStudentsByClass(students, classTargets)
        }
      }
    }
  } catch (e) {
    // ignore filtering on error
  }

  return (
    <main className="mx-auto max-w-4xl p-6 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Nhập lỗi vi phạm</h1>
        <p className="text-sm text-muted-foreground">Danh sách loại lỗi lấy trực tiếp từ bảng criteria.</p>
        {searchParams?.ok === '1' && (
          <p className="text-green-600 text-sm">Đã ghi nhận.</p>
        )}
      </header>
      {supabaseClient ? (
        <ViolationForm students={effectiveStudents} criteria={criteria} />
      ) : (
        <p className="text-sm text-red-600">Supabase chưa được cấu hình. Thiếu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
      )}
    </main>
  )
}
