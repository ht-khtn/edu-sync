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

export const dynamic = "force-dynamic";

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

      if (managedClassIds.size === 0 && classTargets.length > 0) {
        try {
          const { data: usersByName } = await supabaseServer
            .from("users")
            .select("id,class_id,user_name")
            .in("user_name", classTargets);
          for (const u of usersByName || []) {
            if (u.class_id) managedClassIds.add(u.class_id);
          }
        } catch {}
      }

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

      try {
        const classFilterSet = currentClass?.id
          ? new Set<string>([currentClass.id])
          : managedClassIds.size > 0
          ? managedClassIds
          : allowedSet && allowedSet.size > 0
          ? allowedSet
          : null;
        const fetched = await fetchStudentsFromDB(
          supabaseServer,
          undefined,
          classFilterSet === null ? null : classFilterSet || undefined
        );
        if (Array.isArray(fetched) && fetched.length) {
          effectiveStudents = fetched.map((s) => ({
            ...s,
            class_name: classMap.get(s.class_id) ?? "",
          }));
        }
      } catch {}

      if (!effectiveStudents?.length) {
        const fetchedAll = await fetchStudentsFromDB(supabaseServer);
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
          <RecentRecordsList />
        </CardContent>
      </Card>
    </div>
  );
}
