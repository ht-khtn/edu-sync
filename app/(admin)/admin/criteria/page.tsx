import AdminCriteriaPage from "@/components/admin/criteria/page";

export default async function CriteriaRoutePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <AdminCriteriaPage searchParams={params} />;
}
