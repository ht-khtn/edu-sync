import { getServerAuthContext } from "@/lib/server-auth";
import { getAllowedClassIdsForView } from "@/lib/rbac";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trophy, Medal, Award } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

type ClassScore = {
  class_id: string;
  class_name: string;
  total_score: number;
};

export const dynamic = "force-dynamic";

export default async function LeaderboardPageContent() {
  let supabase: SupabaseClient | null = null;
  let appUserId: string | null = null;
  
  try {
    const ctx = await getServerAuthContext();
    supabase = ctx.supabase;
    appUserId = ctx.appUserId;
  } catch {}
  
  if (!supabase) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>Supabase chưa được cấu hình.</AlertDescription>
        </Alert>
      </main>
    );
  }

  const allowedClassIds = appUserId
    ? await getAllowedClassIdsForView(supabase, appUserId)
    : new Set<string>();

  const { data: raw } = await supabase
    .from("records")
    .select("class_id,score,classes(name)")
    .is("deleted_at", null);

  const map = new Map<string, ClassScore>();
  for (const row of raw || []) {
    const cid = row.class_id;
    if (!cid) continue;
    if (allowedClassIds && allowedClassIds.size && !allowedClassIds.has(cid))
      continue;
    const classEntry = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    const existing = map.get(cid) || {
      class_id: cid,
      class_name: classEntry?.name || "—",
      total_score: 0,
    };
    existing.total_score += row.score || 0;
    map.set(cid, existing);
  }

  const data = Array.from(map.values()).sort(
    (a, b) => b.total_score - a.total_score
  );

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
    return null;
  };

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <h1 className="text-3xl font-bold tracking-tight">
          Bảng xếp hạng thi đua
        </h1>
        <p className="text-muted-foreground mt-1">
          Tổng điểm theo lớp (đã trừ vi phạm, cộng hoạt động). Cập nhật thời
          gian thực.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-xl font-semibold">
            Xếp hạng theo lớp
          </CardTitle>
          <CardDescription>Dữ liệu được cập nhật tự động</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-20 font-semibold">#</TableHead>
                  <TableHead className="font-semibold">Lớp</TableHead>
                  <TableHead className="text-right font-semibold">
                    Điểm
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, i) => {
                  const rank = i + 1;
                  return (
                    <TableRow
                      key={row.class_id}
                      className={
                        rank <= 3
                          ? "bg-accent/5 hover:bg-accent/10"
                          : "hover:bg-muted/30"
                      }
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getRankIcon(rank)}
                          <span>{rank}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.class_name}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.total_score}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!data.length && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Chưa có dữ liệu.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
