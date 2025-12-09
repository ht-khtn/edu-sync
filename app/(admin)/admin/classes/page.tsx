import AdminClassesPage from "@/components/admin/classes/Page";

// ISR: Cache for 1 hour, revalidate on demand via revalidateTag('admin-classes')
export const revalidate = 3600;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClassesRoutePage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <AdminClassesPage searchParams={params} />;
}
