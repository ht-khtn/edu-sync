import { ViolationForm } from '@/components/violation/ViolationForm'
import RecentRecordsList from '@/components/violation/RecentRecordsList'
import { fetchCriteriaFromDB, fetchStudentsFromDB, type Criteria, type Student } from '@/lib/violations'
import getSupabase from '@/lib/supabase'
import getSupabaseServer from '@/lib/supabase-server'
import { getAllowedClassIdsForWrite } from '@/lib/rbac'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

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

          // If user is a CC with targets, resolve targets to class IDs.
          const classTargets = (roles || [])
            .filter((r: any) => r.role_id === 'CC' && r.target)
            .map((r: any) => String(r.target))

          const managedClassIds = new Set<string>()
          for (const t of classTargets) {
            const match = (classes || []).find((c: any) => c.name === t)
            if (match?.id) managedClassIds.add(match.id)
          }

          if (managedClassIds.size === 0 && classTargets.length > 0) {
            try {
              const { data: usersByName } = await supabaseServer
                .from('users')
                .select('id,class_id,user_name')
                .in('user_name', classTargets)
              for (const u of usersByName || []) {
                if (u.class_id) managedClassIds.add(u.class_id)
              }
            } catch {}
          }

          if (managedClassIds.size === 1) {
            const onlyId = Array.from(managedClassIds)[0]
            const match = (classes || []).find((c: any) => c.id === onlyId)
            if (match?.id) currentClass = { id: match.id, name: match.name }
          }

          // Determine which class ids the user may write to
          const allowedSet = await getAllowedClassIdsForWrite(supabaseServer, appUserId)

          // Build allowedClasses list (for client select)
          if (allowedSet === null) {
            for (const c of classes || []) allowedClasses.push({ id: c.id, name: c.name })
          } else {
            for (const id of Array.from(allowedSet || [])) {
              const name = classMap.get(id) ?? id
              allowedClasses.push({ id, name })
            }
          }

          // Prefer fetching students server-side with RLS using managedClassIds (if any) else allowedSet
          try {
            let usersQuery = supabaseServer.from('users').select('id,class_id,user_name,user_profiles(full_name,email)')
            if (currentClass?.id) {
              usersQuery = usersQuery.eq('class_id', currentClass.id)
            } else if (managedClassIds.size > 0) {
              usersQuery = usersQuery.in('class_id', Array.from(managedClassIds))
            } else if (allowedSet && allowedSet.size > 0) {
              usersQuery = usersQuery.in('class_id', Array.from(allowedSet))
            }
            const { data: usersData, error: usersErr } = await usersQuery
            if (!usersErr && Array.isArray(usersData)) {
              const serverStudents: Student[] = (usersData as any[]).map((u: any) => ({
                id: u.id,
                student_code: u.user_profiles?.[0]?.email ?? String(u.id).slice(0, 8),
                full_name: u.user_profiles?.[0]?.full_name ?? 'Chưa cập nhật',
                user_name: u.user_name ?? undefined,
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
          <div>
            <CardTitle>Ghi nhận hôm nay</CardTitle>
            <CardDescription>Danh sách các lỗi vi phạm được ghi nhận trong ngày.</CardDescription>
          </div>
        </CardHeader>

        {/* current class display under header */}
        {currentClass && (
          <div className="px-6">
            <div className="mb-4 text-sm text-muted-foreground">Lớp đang ghi nhận hiện tại: <span className="font-medium text-foreground">{currentClass.name}</span></div>
          </div>
        )}

        {/* centered dialog opened by floating FAB */}
        <Dialog>
          <DialogTrigger asChild>
            <button aria-label="Thêm ghi nhận" className="fixed right-6 bottom-6 z-50 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground size-12 shadow-lg">＋</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm lỗi vi phạm</DialogTitle>
              <DialogDescription>Điền thông tin để ghi nhận vi phạm mới.</DialogDescription>
            </DialogHeader>
            <ViolationForm students={effectiveStudents} criteria={criteria} allowedClasses={allowedClasses} currentClass={currentClass} />
          </DialogContent>
        </Dialog>

        <CardContent>
          {supabaseClient ? (
            <RecentRecordsList />
          ) : (
            <p className="text-sm text-red-600">Supabase chưa được cấu hình. Thiếu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
 
