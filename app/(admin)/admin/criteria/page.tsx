import AdminCriteriaPage from "@/components/admin/criteria/page";

// ISR: Cache for 1 hour, criteria data rarely changes
export const revalidate = 3600;

export default async function CriteriaRoutePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <AdminCriteriaPage searchParams={params} />;
}
