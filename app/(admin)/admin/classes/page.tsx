import AdminClassesPage from "@/components/admin/classes/Page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClassesRoutePage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <AdminClassesPage searchParams={params} />;
}
