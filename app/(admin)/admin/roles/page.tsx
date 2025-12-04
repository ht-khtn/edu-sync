import AdminRolesPage from "@/components/admin/roles/Page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RolesRoutePage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <AdminRolesPage searchParams={params} />;
}
