"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import { Download, Calendar, GraduationCap, AlertTriangle } from "lucide-react";

// Excel export (browser-friendly build)
import ExcelJS from "exceljs/dist/exceljs.min.js";

type Grade = { id: string; name: string };

type RecordRow = {
  class_id: string;
  created_at: string;
  score: number;
  criteria: {
    id: string;
    name: string | null;
    group: string | null;
    subgroup: string | null;
  } | null;
  users?: {
    user_profiles?:
      | { full_name?: string | null }
      | { full_name?: string | null }[];
    user_name?: string | null;
  };
};

export default function ExportReportDialog() {
  const [open, setOpen] = useState(false);
  const [baseScore, setBaseScore] = useState<number>(500);
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeId, setGradeId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [criteriaList, setCriteriaList] = useState<Array<{ id: string; name: string; group: string | null; subgroup: string | null }>>([]);
  const [selectedViolations, setSelectedViolations] = useState<Set<string>>(new Set());

  // Group violations by group/subgroup
  const violationGroups = React.useMemo(() => {
    const groups = new Map<string, Map<string, { id: string; name: string; subgroup: string | null }>>();
    for (const c of criteriaList) {
      const g = c.group || "Khác";
      const sg = c.subgroup || c.name || "Mục";
      if (!groups.has(g)) groups.set(g, new Map());
      groups.get(g)!.set(sg, { id: c.id, name: c.name });
    }
    const result = Array.from(groups.entries())
      .map(([group, subs]) => ({
        group,
        subgroups: Array.from(subs.entries()).map(([subgroup, data]) => ({ ...data, subgroup })),
      }))
      .sort((a, b) => a.group.localeCompare(b.group, "vi"));
    return result;
  }, [criteriaList]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const supabase = await getSupabase();
        const [gradesRes, criteriaRes] = await Promise.all([
          supabase.from("grades").select("id,name").order("name"),
          supabase.from("criteria").select("id,name,group,subgroup").order("group,subgroup,name"),
        ]);
        if (gradesRes.error) throw new Error(gradesRes.error.message);
        if (criteriaRes.error) throw new Error(criteriaRes.error.message);
        
        setGrades(gradesRes.data || []);
        setCriteriaList(criteriaRes.data || []);
        
        if (gradesRes.data && gradesRes.data.length) {
          setGradeId((prev) => prev || gradesRes.data![0].id);
        }
        
        // Auto-select all violations on first load
        if (!selectedViolations.size && criteriaRes.data) {
          setSelectedViolations(new Set(criteriaRes.data.map((c) => c.id)));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        toast.error("Không tải được danh sách: " + message);
      }
    })();
  }, [open, selectedViolations.size]);

  async function handleExport() {
    try {
      if (selectedViolations.size === 0) {
        toast.error("Vui lòng chọn ít nhất một loại vi phạm");
        return;
      }
      
      setLoading(true);
      const supabase = await getSupabase();
      // fetch classes of selected grade
      const { data: classes, error: cErr } = await supabase
        .from("classes")
        .select("id,name")
        .eq("grade_id", gradeId)
        .order("name");
      if (cErr) throw new Error(cErr.message);
      const classIds = (classes || []).map((c) => c.id);
      if (classIds.length === 0)
        throw new Error("Không có lớp thuộc khối đã chọn");

      // fetch records in range for these classes with selected criteria only
      let q = supabase
        .from("records")
        .select(
          "class_id, created_at, score, criteria(id,name,group,subgroup), users:student_id(user_profiles(full_name),user_name)"
        )
        .is("deleted_at", null)
        .in("class_id", classIds)
        .in("criteria_id", Array.from(selectedViolations))
        .order("created_at", { ascending: true });

      if (start) {
        const s = new Date(start);
        if (!isNaN(s.getTime())) q = q.gte("created_at", s.toISOString());
      }
      if (end) {
        const e = new Date(end);
        if (!isNaN(e.getTime())) {
          e.setHours(23, 59, 59, 999);
          q = q.lte("created_at", e.toISOString());
        }
      }

      const { data: rows, error: rErr } = await q.limit(100000);
      if (rErr) throw new Error(rErr.message);
      const recs = (rows || []) as unknown as RecordRow[];

      // Build group/subgroup axes from SELECTED criteria (not from records)
      const selectedCriteria = criteriaList.filter((c) => selectedViolations.has(c.id));
      const groups = new Map<string, Map<string, true>>();
      for (const c of selectedCriteria) {
        const g = c.group || "Khác";
        const sg = c.subgroup || c.name || "Mục";
        if (!groups.has(g)) groups.set(g, new Map());
        groups.get(g)!.set(sg, true);
      }

      // Sort groups and subgroups by name
      const sortedGroups = Array.from(groups.keys()).sort((a, b) =>
        a.localeCompare(b, "vi")
      );
      const groupToSubgroups = new Map<string, string[]>();
      for (const g of sortedGroups) {
        const subs = Array.from(groups.get(g)!.keys()).sort((a, b) =>
          a.localeCompare(b, "vi")
        );
        groupToSubgroups.set(g, subs);
      }

      // Aggregate per class
      const classMap = new Map<
        string,
        {
          name: string;
          byGroup: Map<
            string,
            {
              bySub: Map<
                string,
                { entries: string[]; count: number; deduction: number }
              >;
              totalDeduction: number;
            }
          >;
          totalPoints: number;
        }
      >();
      const classNameById = new Map<string, string>();
      for (const c of classes || []) classNameById.set(c.id, c.name || c.id);

      for (const r of recs) {
        const cls = r.class_id;
        const className = classNameById.get(cls) || cls;
        const g = r.criteria?.group || "Khác";
        const sg = r.criteria?.subgroup || r.criteria?.name || "Mục";
        const score = Number(r.score || 0);
        const fullName = (() => {
          const up = r.users?.user_profiles;
          const prof = Array.isArray(up) ? up[0] : up;
          return prof?.full_name || r.users?.user_name || "";
        })();
        const dateStr = new Date(r.created_at).toLocaleDateString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
        });
        const entry = `${dateStr}: ${fullName}`;

        if (!classMap.has(cls))
          classMap.set(cls, {
            name: className,
            byGroup: new Map(),
            totalPoints: 0,
          });
        const classData = classMap.get(cls)!;
        if (!classData.byGroup.has(g))
          classData.byGroup.set(g, { bySub: new Map(), totalDeduction: 0 });
        const gData = classData.byGroup.get(g)!;
        if (!gData.bySub.has(sg))
          gData.bySub.set(sg, { entries: [], count: 0, deduction: 0 });
        const sData = gData.bySub.get(sg)!;
        sData.entries.push(entry);
        sData.count += 1;
        sData.deduction += Math.abs(score < 0 ? score : -Math.abs(score)); // ensure deduction positive
        gData.totalDeduction += Math.abs(score < 0 ? score : -Math.abs(score));
      }

      // Ensure all classes exist in classMap (even if no records)
      for (const className of classNameById.values()) {
        if (!classMap.has(className)) {
          // This shouldn't happen since we're iterating classIds, but add safety
        }
      }
      for (const classId of classIds) {
        if (!classMap.has(classId)) {
          const className = classNameById.get(classId) || classId;
          classMap.set(classId, {
            name: className,
            byGroup: new Map(),
            totalPoints: 0,
          });
        }
      }

      // Ensure all selected groups/subgroups exist for all classes
      for (const [, classData] of classMap) {
        for (const g of sortedGroups) {
          if (!classData.byGroup.has(g)) {
            classData.byGroup.set(g, { bySub: new Map(), totalDeduction: 0 });
          }
          const gData = classData.byGroup.get(g)!;
          const subs = groupToSubgroups.get(g) || [];
          for (const sg of subs) {
            if (!gData.bySub.has(sg)) {
              gData.bySub.set(sg, { entries: [], count: 0, deduction: 0 });
            }
          }
        }
      }

      // Compute totals
      for (const [, data] of classMap) {
        const totalDeductionAcross = Array.from(data.byGroup.values()).reduce(
          (acc, g) => acc + (g.totalDeduction || 0),
          0
        );
        data.totalPoints = baseScore - totalDeductionAcross;
      }

      // Prepare Excel
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Bao cao");

      // Build header rows
      const headerRow1: (string | null)[] = [];
      const headerRow2: (string | null)[] = [];
      const headerRow3: (string | null)[] = [];

      // First column for class name
      headerRow1.push("LỚP");
      headerRow2.push(null);
      headerRow3.push(null);

      for (const g of sortedGroups) {
        const subs = groupToSubgroups.get(g) || [];
        for (const sg of subs) {
          headerRow1.push(g);
          headerRow2.push(sg);
          headerRow3.push("Ngày/Tên hs");
          headerRow1.push(g);
          headerRow2.push(sg);
          headerRow3.push("Số lượt");
        }
        // Group-level Điểm trừ column
        headerRow1.push(g);
        headerRow2.push("Điểm trừ");
        headerRow3.push(null);
      }

      // Trailing columns
      headerRow1.push("");
      headerRow2.push("TỔNG ĐIỂM");
      headerRow3.push(null);

      headerRow1.push("");
      headerRow2.push("HẠNG");
      headerRow3.push(null);

      headerRow1.push("");
      headerRow2.push("LỚP");
      headerRow3.push(null);

      ws.addRow(headerRow1);
      ws.addRow(headerRow2);
      ws.addRow(headerRow3);

      // Merge cells for headers
      // Merge first column over 3 rows
      ws.mergeCells(1, 1, 3, 1);
      // Merge group headers across their blocks
      let cursor = 2;
      for (const g of sortedGroups) {
        const subs = groupToSubgroups.get(g) || [];
        const width = subs.length * 2 + 1; // +1 for Điểm trừ
        if (width > 1) ws.mergeCells(1, cursor, 1, cursor + width - 1);
        // merge subgroup names over two columns
        for (let i = 0; i < subs.length; i++) {
          ws.mergeCells(2, cursor + i * 2, 2, cursor + i * 2 + 1);
        }
        // merge Điểm trừ header cell over 2 rows
        ws.mergeCells(2, cursor + subs.length * 2, 3, cursor + subs.length * 2);
        cursor += width;
      }
      // Merge trailing column headers over two rows
      ws.mergeCells(2, cursor, 3, cursor); // Tổng điểm
      ws.mergeCells(2, cursor + 1, 3, cursor + 1); // Hạng
      ws.mergeCells(2, cursor + 2, 3, cursor + 2); // Lớp

      // Style headers lightly
      for (let r = 1; r <= 3; r++) {
        const row = ws.getRow(r);
        row.font = { bold: true };
        row.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
      }

      // Build data rows in class name order
      const classEntries = Array.from(classMap.entries()).sort((a, b) =>
        a[1].name.localeCompare(b[1].name, "vi")
      );
      // First compute ranks
      const totals = classEntries.map(([, d]) => d.totalPoints);
      const sortedTotals = Array.from(
        new Set(totals.slice().sort((a, b) => b - a))
      );
      const rankByTotal = new Map<number, number>();
      sortedTotals.forEach((t, i) => rankByTotal.set(t, i + 1));

      for (const [, data] of classEntries) {
        const row: (string | number | null)[] = [];
        row.push(data.name);
        for (const g of sortedGroups) {
          const subs = groupToSubgroups.get(g) || [];
          const gData = data.byGroup.get(g);
          for (const sg of subs) {
            const sData = gData?.bySub.get(sg);
            const text = sData?.entries?.join("\n") || "";
            const count = sData?.count || 0;
            row.push(text);
            row.push(count);
          }
          row.push(gData?.totalDeduction || 0);
        }
        row.push(data.totalPoints);
        row.push(rankByTotal.get(data.totalPoints) || null);
        row.push(data.name);
        const r = ws.addRow(row);
        // wrap text for day/name cells
        r.alignment = { vertical: "top", wrapText: true };
      }

      // Column widths (rough defaults)
      ws.getColumn(1).width = 10;
      for (let c = 2; c <= ws.columnCount; c++) {
        ws.getColumn(c).width = 16;
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const startStr = start
        ? new Date(start).toLocaleDateString("vi-VN")
        : "all";
      const endStr = end ? new Date(end).toLocaleDateString("vi-VN") : "all";
      a.href = url;
      a.download = `bao_cao_khoi_${
        grades.find((g) => g.id === gradeId)?.name || "unknown"
      }_${startStr}_${endStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Đã tạo file Excel");
      setOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      console.error(e);
      toast.error("Xuất báo cáo thất bại: " + message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="default"
          className="gap-2 bg-primary hover:bg-primary/90 shadow-sm"
        >
          <Download className="h-4 w-4" />
          Xuất báo cáo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            Xuất báo cáo Excel
          </DialogTitle>
          <DialogDescription>
            Tạo báo cáo tổng hợp vi phạm theo khối và khoảng thời gian
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-96 overflow-y-auto">
          <Card className="bg-muted/50 border-muted">
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Chọn loại vi phạm</h3>
              </div>
              <Separator className="bg-border" />
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedViolations(new Set(criteriaList.map((c) => c.id)))}
                  >
                    Chọn tất cả
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedViolations(new Set())}
                  >
                    Bỏ chọn tất cả
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-2 bg-background">
                  {violationGroups.map((group) => (
                    <div key={group.group} className="space-y-1">
                      <div className="font-medium text-sm pl-1">{group.group}</div>
                      <div className="space-y-1 pl-4">
                        {group.subgroups.map((sub) => (
                          <label key={sub.id} className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={selectedViolations.has(sub.id)}
                              onChange={(e) => {
                                const newSet = new Set(selectedViolations);
                                if (e.target.checked) {
                                  newSet.add(sub.id);
                                } else {
                                  newSet.delete(sub.id);
                                }
                                setSelectedViolations(newSet);
                              }}
                              className="w-4 h-4 rounded"
                            />
                            <span>{sub.subgroup || sub.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Đã chọn: {selectedViolations.size}/{criteriaList.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-muted/50 border-muted">
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Thông tin cơ bản</h3>
              </div>
              <Separator className="bg-border" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="base-score" className="text-sm font-medium">
                    Điểm cơ sở
                  </Label>
                  <Input
                    id="base-score"
                    type="number"
                    value={baseScore}
                    onChange={(e) => setBaseScore(Number(e.target.value || 0))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade-select" className="text-sm font-medium">
                    Khối lớp
                  </Label>
                  <Select value={gradeId} onValueChange={setGradeId}>
                    <SelectTrigger id="grade-select" className="h-10">
                      <SelectValue placeholder="Chọn khối" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-muted/50 border-muted">
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Khoảng thời gian</h3>
              </div>
              <Separator className="bg-border" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-date" className="text-sm font-medium">
                    Từ ngày
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date" className="text-sm font-medium">
                    Đến ngày
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Hủy
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading || !gradeId}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Đang xuất...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Xuất Excel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
