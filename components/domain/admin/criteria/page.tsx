import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { summarizeCriteria } from './stats'
import { CriteriaTable } from './CriteriaTable'
import { CriteriaFilters, type CriteriaFilterState } from './CriteriaFilters'
import { CreateCriteriaDialog } from './CreateCriteriaDialog'
import QueryToasts from '@/components/common/QueryToasts'
import { getServerAuthContext, getServerRoles, summarizeRoles } from '@/lib/server-auth'
import { hasAdminManagementAccess } from '@/lib/admin-access'
import { fetchCriteriaFromDB, type Criteria } from '@/lib/violations'

export const dynamic = 'force-dynamic'

export default async function AdminCriteriaPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const [{ supabase, appUserId }, roles] = await Promise.all([
    getServerAuthContext(),
    getServerRoles()
  ])
  
  if (!appUserId) redirect('/login')

  const summary = summarizeRoles(roles)
  if (!hasAdminManagementAccess(summary)) redirect('/admin')

  const filters = normalizeFilter(searchParams)
  const criteria = await fetchCriteriaFromDB(supabase, { includeInactive: true })
  const filteredRows = applyFilters(criteria, filters)
  const stats = summarizeCriteria(criteria)

  const okParam = getParam(searchParams, 'ok')
  const errParam = getParam(searchParams, 'error')

  return (
    <section className="space-y-6">
      <QueryToasts ok={okParam} error={errParam} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý tiêu chí vi phạm</h1>
          <p className="text-muted-foreground mt-1">Cấu hình tiêu chí dùng để ghi nhận vi phạm. Chỉ AD/MOD được truy cập.</p>
        </div>
        <CreateCriteriaDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Tổng tiêu chí" value={stats.total} />
        <SummaryCard title="Đang sử dụng" value={stats.active} />
        <SummaryCard title="Theo phạm vi" value={formatSummary(stats.byCategory)} />
        <SummaryCard title="Theo mức độ" value={formatSummary(stats.byType)} />
      </div>

      <CriteriaFilters initial={filters} />

      {criteria.length === 0 ? (
        <Alert>
          <AlertDescription>Chưa có tiêu chí nào. Hãy tạo mới để bắt đầu sử dụng module vi phạm.</AlertDescription>
        </Alert>
      ) : (
        <CriteriaTable rows={filteredRows} />
      )}
    </section>
  )
}

function normalizeFilter(searchParams?: Record<string, string | string[] | undefined>): CriteriaFilterState {
  const get = (key: string) => {
    const raw = searchParams?.[key]
    if (Array.isArray(raw)) return raw[0]
    return raw ?? ''
  }
  return {
    q: get('q') || undefined,
    category: get('category') || undefined,
    type: get('type') || undefined,
    status: get('status') || undefined,
  }
}

function applyFilters(criteria: Criteria[], filters: CriteriaFilterState) {
  return criteria.filter((item) => {
    if (filters.status === 'active' && !item.isActive) return false
    if (filters.status === 'inactive' && item.isActive) return false
    if (filters.category && item.category !== filters.category) return false
    if (filters.type && item.type !== filters.type) return false
    if (filters.q) {
      const q = filters.q.toLowerCase()
      const text = [item.name, item.description, item.group, item.subgroup].filter(Boolean).join(' ').toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  })
}

function SummaryCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold break-words">{value}</div>
      </CardContent>
    </Card>
  )
}

function formatSummary(map: Record<string, number>) {
  const entries = Object.entries(map)
  if (!entries.length) return '0'
  return entries
    .map(([key, count]) => {
      if (key === 'class') return `${count} tập thể`
      if (key === 'student') return `${count} học sinh`
      if (key === 'normal') return `${count} thường`
      if (key === 'serious') return `${count} nghiêm trọng`
      if (key === 'critical') return `${count} rất nghiêm trọng`
      return `${count} ${key}`
    })
    .join(', ')
}

function getParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const raw = searchParams?.[key]
  if (Array.isArray(raw)) return raw[0]
  return raw
}
