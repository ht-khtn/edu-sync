import { ViolationForm } from '@/components/violation/ViolationForm'
import RecentRecordsList from '@/components/violation/RecentRecordsList'
import { fetchCriteriaFromDB, fetchStudentsFromDB, type Criteria, type Student } from '@/lib/violations'
import getSupabaseServer from '@/lib/supabase-server'
import { getAllowedClassIdsForWrite } from '@/lib/rbac'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export const dynamic = 'force-dynamic'

export default async function ViolationEntryPageContent({ searchParams }: { searchParams?: { ok?: string, error?: string } }) {
  const supabaseServer = await getSupabaseServer()
  // Fetch criteria server-side (works regardless of client env)
  const criteria: Criteria[] = await fetchCriteriaFromDB(supabaseServer)
  let students: Student[] = []

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

          // Fetch students server-side with optional class filters for better performance
          try {
            const classFilterSet = currentClass?.id
              ? new Set<string>([currentClass.id])
              : (managedClassIds.size > 0 ? managedClassIds : (allowedSet && allowedSet.size > 0 ? allowedSet : null))
            const fetched = await fetchStudentsFromDB(supabaseServer, undefined, classFilterSet === null ? null : classFilterSet || undefined)
            if (Array.isArray(fetched) && fetched.length) {
              effectiveStudents = fetched.map((s) => ({ ...s, class_name: classMap.get(s.class_id) ?? '' }))
            }
          } catch {}

          // Fallback to client-fetched students if server fetch failed or returned empty
          if (!effectiveStudents?.length) {
            // As ultimate fallback, fetch all students without filter (server)
            const fetchedAll = await fetchStudentsFromDB(supabaseServer)
            const studentsWithClass = fetchedAll.map((s) => ({ ...s, class_name: classMap.get(s.class_id) ?? '' }))
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
          <RecentRecordsList />
        </CardContent>
      </Card>
    </main>
  )
}
 
