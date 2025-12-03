import AdminCriteriaPage from '@/components/domain/admin/criteria/page'

export const dynamic = 'force-dynamic'

export default function CriteriaRoutePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  return <AdminCriteriaPage searchParams={searchParams} />
}
