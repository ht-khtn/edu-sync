import AdminAccountsPage from "@/components/admin/accounts/Page";

// ISR: Cache for 1 hour, revalidate on demand via revalidateTag('admin-accounts')
export const revalidate = 3600;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountsRoutePage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <AdminAccountsPage searchParams={params} />;
}
