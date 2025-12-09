import { ViolationHistoryPageContent } from "@/components/admin/violation-history/ViolationHistoryComponents";
import RecordsRealtimeListener from "@/components/admin/violation/RecordsRealtimeListener";

// ISR: Revalidate every 60s. Violation data is semi-static.
export const revalidate = 60;

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
