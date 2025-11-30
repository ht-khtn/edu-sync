import AdminRolesPage from '@/components/domain/admin/roles/Page'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default function RolesRoutePage({ searchParams }: PageProps) {
  return <AdminRolesPage searchParams={searchParams} />
}
