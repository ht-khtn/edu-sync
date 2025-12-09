import AdminRolesPage from "@/components/admin/roles/Page";

// ISR: Cache for 1 hour, revalidate on demand via revalidateTag('admin-roles')
export const revalidate = 3600;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RolesRoutePage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <AdminRolesPage searchParams={params} />;
}
