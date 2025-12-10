import { getServerSupabase } from "@/lib/server-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SupabaseClient } from "@supabase/supabase-js";
import LeaderboardClient from "./LeaderboardClient";

type ClassData = {
  class_id: string;
  class_name: string;
  grade: string;
  total_violation_score: number;
};

export default async function LeaderboardPageContent() {
  // Auth handled by middleware - get Supabase client directly
  let supabase: SupabaseClient | null = null;

  try {
    supabase = await getServerSupabase();
  } catch {}

  if (!supabase) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <Alert variant="destructive">
          <AlertDescription>Supabase chưa được cấu hình.</AlertDescription>
        </Alert>
      </main>
    );
  }

  // Note: getAllowedClassIdsForView needs appUserId internally
  // We'll pass null for now since RBAC filtering is business logic, not auth
  const allowedClassIds = new Set<string>();

  // Fetch all classes with their grades
  const { data: allClasses } = await supabase
    .from("classes")
    .select("id, name, grade_id, grades(name)")
    .order("name");

  // Fetch all violation records
  const { data: raw } = await supabase
    .from("records")
    .select("class_id, score")
    .is("deleted_at", null);

  // Build violation score map
  // Note: score in records is typically negative (e.g., -4 for -4 points)
  // We need to ensure total_violation_score represents the SUM of penalties
  // so that: final_points = basePoints - total_violation_score
  // Example: if penalties are -4, -5, total_violation_score should be 9 (absolute sum)
  const violationScoreMap = new Map<string, number>();
  for (const row of raw || []) {
    const cid = row.class_id;
    if (!cid) continue;
    const existing = violationScoreMap.get(cid) || 0;
    // Convert to absolute value to get total penalty points
    const penalty = Math.abs(row.score || 0);
    violationScoreMap.set(cid, existing + penalty);
  }

  // Build complete class list with violation scores
  const classDataList: ClassData[] = [];
  for (const cls of allClasses || []) {
    const classId = cls.id;
    if (!classId) continue;

    // Apply RBAC filtering for view access
    if (allowedClassIds && allowedClassIds.size && !allowedClassIds.has(classId)) continue;

    const gradeInfo = Array.isArray(cls.grades) ? cls.grades[0] : cls.grades;
    const gradeName = gradeInfo?.name || "—";
    const violationScore = violationScoreMap.get(classId) || 0;

    classDataList.push({
      class_id: classId,
      class_name: cls.name || "—",
      grade: gradeName,
      total_violation_score: violationScore,
    });
  }

  return (
    <div className="p-6" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <h1 className="text-3xl font-bold tracking-tight">Bảng xếp hạng thi đua</h1>
        <p className="text-muted-foreground mt-1">
          Tổng điểm theo lớp (Điểm cơ sở - tổng vi phạm). Cập nhật thời gian thực.
        </p>
      </div>

      <div className="mt-6">
        <LeaderboardClient initialData={classDataList} />
      </div>
    </div>
  );
}
