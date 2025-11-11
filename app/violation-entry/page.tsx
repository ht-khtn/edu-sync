import { ViolationForm } from '@/components/violation/ViolationForm'
import { fetchCriteriaFromDB, fetchStudentsFromDB, filterStudentsByClass } from '@/lib/violations'
import getSupabase from '@/lib/supabase'
import getSupabaseServer from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function ViolationEntryPage({ searchParams }: { searchParams?: { ok?: string } }) {
  const [supabaseClient, supabaseServer] = await Promise.all([getSupabase(), getSupabaseServer()])
  // TODO: derive classId from auth user; for now fetch all
  const [criteria, students] = await Promise.all([
    fetchCriteriaFromDB(supabaseClient),
    fetchStudentsFromDB(supabaseClient)
  ])

  // Server-side auth-based filtering: map auth user -> app user id -> roles/classes
  let effectiveStudents = students
  try {
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
        const [{ data: roles }, { data: classes }] = await Promise.all([
          supabaseServer.from('user_roles').select('role_id,target').eq('user_id', appUserId),
          supabaseServer.from('classes').select('id').eq('homeroom_teacher_id', appUserId),
        ])
        const classTargets = (roles || [])
          .filter((r: any) => r.role_id === 'CC' && r.target)
          .map((r: any) => String(r.target))
        effectiveStudents = filterStudentsByClass(students, classTargets)
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
          <p className="text-green-600 text-sm">Đã ghi nhận (mock, chưa lưu DB).</p>
        )}
      </header>
      <ViolationForm students={effectiveStudents} criteria={criteria} />
    </main>
  )
}
