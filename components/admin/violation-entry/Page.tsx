import { ViolationForm } from "@/components/admin/violation/ViolationForm";
import RecentRecordsList from "@/components/admin/violation/RecentRecordsList";
import {
  fetchCriteriaFromDB,
  fetchStudentsFromDB,
  type Criteria,
  type Student,
} from "@/lib/violations";
import { getServerAuthContext } from "@/lib/server-auth";
import { getAllowedClassIdsForWrite } from "@/lib/rbac";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Natural (numeric-aware) comparator so class names like 10A9 sort before 10A10
function naturalCompare(a: string | null | undefined, b: string | null | undefined) {
  const sa = String(a ?? '')
  const sb = String(b ?? '')
  const re = /(\d+|\D+)/g
  const ta = sa.match(re) || []
  const tb = sb.match(re) || []
  const len = Math.max(ta.length, tb.length)
  for (let i = 0; i < len; i++) {
    const pa = ta[i] || ''
    const pb = tb[i] || ''
    const na = pa.match(/^\d+$/)
    const nb = pb.match(/^\d+$/)
    if (na && nb) {
      const da = Number(pa)
      const db = Number(pb)
      if (da !== db) return da - db
    } else if (pa !== pb) {
      return pa.localeCompare(pb, undefined, { numeric: true, sensitivity: 'base' })
    }
  }
  return 0
}

export default async function ViolationEntryPageContent() {
  const { supabase: supabaseServer, appUserId } = await getServerAuthContext();
  const criteria: Criteria[] = await fetchCriteriaFromDB(supabaseServer);
  const students: Student[] = [];

  let effectiveStudents = students;
  let allowedClasses: { id: string; name: string }[] = [];
  let currentClass: { id: string; name: string } | null = null;
  try {
    if (supabaseServer && appUserId) {
      const [{ data: roles }, { data: classes }] = await Promise.all([
        supabaseServer
          .from("user_roles")
          .select("role_id,target")
          .eq("user_id", appUserId),
        supabaseServer.from("classes").select("id,name"),
      ]);

      const classMap = new Map<string, string>();
      for (const c of classes || []) classMap.set(c.id, c.name);

      const classTargets = (roles || [])
        .filter((r) => r.role_id === "CC" && r.target)
        .map((r) => String(r.target));

      const managedClassIds = new Set<string>();
      for (const t of classTargets) {
        const match = (classes || []).find((c) => c.name === t);
        if (match?.id) managedClassIds.add(match.id);
      }

      // Removed fallback query - if class not found by name, it doesn't exist

      if (managedClassIds.size === 1) {
        const onlyId = Array.from(managedClassIds)[0];
        const match = (classes || []).find((c) => c.id === onlyId);
        if (match?.id) currentClass = { id: match.id, name: match.name };
      }

      const allowedSet = await getAllowedClassIdsForWrite(
        supabaseServer,
        appUserId
      );

      if (allowedSet === null) {
        for (const c of classes || [])
          allowedClasses.push({ id: c.id, name: c.name });
      } else {
        for (const id of Array.from(allowedSet || [])) {
          const name = classMap.get(id) ?? id;
          allowedClasses.push({ id, name });
        }
      }

      // Sort classes in a natural / numeric-aware order so that e.g. 10A9 comes before 10A10
      allowedClasses.sort((x, y) => naturalCompare(x?.name, y?.name));

      try {
        const classFilterSet = currentClass?.id
          ? new Set<string>([currentClass.id])
          : managedClassIds.size > 0
          ? managedClassIds
          : allowedSet && allowedSet.size > 0
          ? allowedSet
          : null;
        const result = await fetchStudentsFromDB(
          supabaseServer,
          undefined,
          classFilterSet === null ? null : classFilterSet || undefined,
          100,  // limit
          0     // offset
        );
        const fetched = result.students;
        if (Array.isArray(fetched) && fetched.length) {
          effectiveStudents = fetched.map((s) => ({
            ...s,
            class_name: classMap.get(s.class_id) ?? "",
          }));
        }
      } catch {}

      if (!effectiveStudents?.length) {
        const fetchedAllResult = await fetchStudentsFromDB(supabaseServer, undefined, null, 100, 0);
        const fetchedAll = fetchedAllResult.students;
        const studentsWithClass = fetchedAll.map((s) => ({
          ...s,
          class_name: classMap.get(s.class_id) ?? "",
        }));
        if (currentClass) {
          effectiveStudents = studentsWithClass.filter(
            (s) => s.class_id === currentClass?.id
          );
          allowedClasses = [
            { id: currentClass.id, name: currentClass.name },
          ];
        } else if (allowedSet === null) {
          effectiveStudents = studentsWithClass;
        } else {
          const allowedIds = new Set(Array.from(allowedSet || []));
          effectiveStudents = studentsWithClass.filter((s) =>
            allowedIds.has(s.class_id)
          );
        }
      }
    }
  } catch (error) {
    console.warn('violation-entry preload error', error)
  }

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <h1 className="text-3xl font-bold tracking-tight">Ghi nhận vi phạm</h1>
        <p className="text-muted-foreground mt-1">
          Danh sách các lỗi vi phạm được ghi nhận trong ngày.
        </p>
      </div>

      {currentClass && (
        <Alert>
          <AlertDescription>
            Lớp đang ghi nhận hiện tại:{" "}
            <span className="font-semibold">{currentClass.name}</span>
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">
                Ghi nhận hôm nay
              </CardTitle>
              <CardDescription>
                Các vi phạm được ghi nhận trong ngày
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="shadow-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm ghi nhận
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Thêm lỗi vi phạm</DialogTitle>
                  <DialogDescription>
                    Điền thông tin để ghi nhận vi phạm mới.
                  </DialogDescription>
                </DialogHeader>
                <ViolationForm
                  students={effectiveStudents}
                  criteria={criteria}
                  allowedClasses={allowedClasses}
                  currentClass={currentClass}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <Suspense fallback={<RecentRecordsSkeleton />}>
            <RecentRecordsList />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

function RecentRecordsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}
