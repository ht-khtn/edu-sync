import AdminAccountsPage from '@/components/domain/admin/accounts/Page'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default function AccountsRoutePage({ searchParams }: PageProps) {
  return <AdminAccountsPage searchParams={searchParams} />
}
