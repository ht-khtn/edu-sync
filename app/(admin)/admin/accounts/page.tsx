import AdminAccountsPage from "@/components/admin/accounts/Page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountsRoutePage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <AdminAccountsPage searchParams={params} />;
}
