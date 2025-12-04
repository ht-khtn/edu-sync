import AdminCriteriaPage from '@/components/admin/criteria/page'

export default function CriteriaRoutePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  return <AdminCriteriaPage searchParams={searchParams} />
}
