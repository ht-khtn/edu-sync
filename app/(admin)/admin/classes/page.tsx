import AdminClassesPage from '@/components/domain/admin/classes/Page'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default function ClassesRoutePage({ searchParams }: PageProps) {
  return <AdminClassesPage searchParams={searchParams} />
}
