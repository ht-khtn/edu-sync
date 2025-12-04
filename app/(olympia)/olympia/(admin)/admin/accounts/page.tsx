import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ensureOlympiaAdminAccess } from '@/lib/olympia-access'
import { getServerAuthContext } from '@/lib/server-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/utils/cn'

export const dynamic = 'force-dynamic'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const filterOptions = [
  { id: 'all', label: 'Tất cả' },
  { id: 'admin', label: 'Admin' },
  { id: 'contestant', label: 'Thí sinh' },
  { id: 'other', label: 'Khác' },
] as const

type FilterOption = (typeof filterOptions)[number]['id']

type ParticipantRow = {
  user_id: string
  contestant_code: string | null
  role: string | null
  created_at: string | null
}

type UserProfileRow = {
  full_name: string | null
} | null

type UserRow = {
  id: string
  user_name: string | null
  email: string | null
  class_id: string | null
  user_profiles: UserProfileRow | UserProfileRow[] | null
}

type AccountsPageProps = {
  searchParams?: {
    role?: string
  }
}

function resolveProfileName(user: UserRow | undefined) {
  if (!user) return '—'
  if (Array.isArray(user.user_profiles)) {
    return user.user_profiles[0]?.full_name ?? user.user_name ?? '—'
  }
  return user.user_profiles?.full_name ?? user.user_name ?? '—'
}

function resolveRoleCategory(participant: ParticipantRow): FilterOption {
  if (participant.role === 'AD') return 'admin'
  if (participant.role && participant.role !== 'AD') return 'other'
  if (participant.contestant_code) return 'contestant'
  return 'other'
}

export default async function OlympiaAdminAccountsPage({ searchParams }: AccountsPageProps) {
  const authContext = await getServerAuthContext()
  if (!authContext.appUserId) {
    notFound()
  }
  await ensureOlympiaAdminAccess()

  const olympia = authContext.supabase.schema('olympia')
  const { data: participants, error: participantsError } = await olympia
    .from('participants')
    .select('user_id, contestant_code, role, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (participantsError) {
    console.error('[Olympia] load participants failed', participantsError.message)
  }

  const participantRows: ParticipantRow[] = participants ?? []
  const userIds = participantRows.map((row) => row.user_id)
  const usersMap = new Map<string, UserRow>()

  if (userIds.length > 0) {
    const { data: usersData } = await authContext.supabase
      .from('users')
      .select('id, user_name, email, class_id, user_profiles(full_name)')
      .in('id', userIds)
    for (const user of usersData ?? []) {
      usersMap.set(user.id, user)
    }
  }

  const totalAccounts = participantRows.length
  const adminCount = participantRows.filter((row) => row.role === 'AD').length
  const contestantCount = participantRows.filter((row) => row.role !== 'AD' && row.contestant_code).length

  const filterValue = filterOptions.some((option) => option.id === searchParams?.role)
    ? (searchParams?.role as FilterOption)
    : 'all'

  const rowsWithCategory = participantRows.map((row) => ({
    ...row,
    category: resolveRoleCategory(row),
    user: usersMap.get(row.user_id),
  }))

  const visibleRows = rowsWithCategory.filter((row) => (filterValue === 'all' ? true : row.category === filterValue))

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Olympia</p>
          <h1 className="text-3xl font-semibold tracking-tight">Quản lý admin &amp; tài khoản thi</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Hiển thị tối đa 200 bản ghi gần nhất từ bảng <code className="rounded bg-slate-100 px-1">olympia.participants</code>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tổng tài khoản</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{totalAccounts}</p>
            <p className="text-xs text-muted-foreground">Kể cả admin, thí sinh, các quyền khác.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Olympia Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{adminCount}</p>
            <p className="text-xs text-muted-foreground">Role = AD</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tài khoản thi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{contestantCount}</p>
            <p className="text-xs text-muted-foreground">Có mã contestant_code</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Lọc theo nhóm</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              const href = option.id === 'all' ? '/olympia/admin/accounts' : `/olympia/admin/accounts?role=${option.id}`
              const isActive = filterValue === option.id
              return (
                <Link
                  key={option.id}
                  href={href}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors',
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-muted-foreground hover:border-slate-400'
                  )}
                >
                  {option.label}
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {participantsError ? (
        <Alert variant="destructive">
          <AlertDescription>Không thể tải danh sách participants: {participantsError.message}</AlertDescription>
        </Alert>
      ) : null}

      {visibleRows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Không có bản ghi phù hợp với bộ lọc hiện tại.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Danh sách chi tiết</CardTitle>
            <p className="text-xs text-muted-foreground">Bao gồm thông tin liên hệ và vai trò hiện tại.</p>
          </CardHeader>
          <Separator />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Mã thí sinh</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Ngày thêm</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => {
                  const user = row.user
                  const roleLabel = row.role === 'AD' ? 'Admin' : row.role ?? 'Thí sinh'
                  return (
                    <TableRow key={`${row.user_id}-${row.contestant_code ?? 'na'}`}>
                      <TableCell>
                        <div className="font-medium">{resolveProfileName(user)}</div>
                        <div className="text-xs text-muted-foreground">{user?.email ?? '—'}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{row.contestant_code ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={row.role === 'AD' ? 'default' : 'secondary'}>{roleLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.created_at ? dateFormatter.format(new Date(row.created_at)) : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </section>
  )
}
