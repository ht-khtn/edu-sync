import { ViolationHistoryPageContent } from "@/components/admin/violation-history/ViolationHistoryComponents";
import RecordsRealtimeListener from "@/components/admin/violation/RecordsRealtimeListener";

export const dynamic = "force-dynamic";

export default async function ViolationHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <>
      <ViolationHistoryPageContent searchParams={params} />
      <RecordsRealtimeListener />
    </>
  );
}
