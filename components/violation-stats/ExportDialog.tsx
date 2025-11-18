"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Download, Calendar, GraduationCap } from "lucide-react";

// Excel export
import ExcelJS from "exceljs";

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

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data, error } = await supabase
          .from("grades")
          .select("id,name")
          .order("name");
        if (error) throw new Error(error.message);
        setGrades(data || []);
        if (!gradeId && data && data.length) setGradeId(data[0].id);
      } catch (e: any) {
        toast.error("Không tải được danh sách khối: " + (e?.message || ""));
      }
    })();
  }, [open]);

  async function handleExport() {
    try {
      setLoading(true);
      const supabase = await getSupabase();
      // fetch classes of selected grade
      const { data: classes, error: cErr } = await supabase
        .from("classes")
        .select("id,name")
        .eq("grade_id", gradeId)
        .order("name");
      if (cErr) throw new Error(cErr.message);
      const classIds = (classes || []).map((c: any) => c.id);
      if (classIds.length === 0)
        throw new Error("Không có lớp thuộc khối đã chọn");

      // fetch records in range for these classes
      let q = supabase
        .from("records")
        .select(
          "class_id, created_at, score, criteria(id,name,group,subgroup), users:student_id(user_profiles(full_name),user_name)"
        )
        .is("deleted_at", null)
        .in("class_id", classIds)
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

      // Build group/subgroup axes from criteria
      const groups = new Map<string, Map<string, true>>();
      for (const r of recs) {
        const g = r.criteria?.group || "Khác";
        const sg = r.criteria?.subgroup || r.criteria?.name || "Mục";
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
          const up = (r as any).users?.user_profiles;
          const prof = Array.isArray(up) ? up[0] : up;
          return prof?.full_name || (r as any).users?.user_name || "";
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

      // Compute totals
      for (const [cls, data] of classMap) {
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

      // Column index tracker starts at 1 in ExcelJS
      let colIdx = 2;
      const groupStartCol: Record<string, number> = {};
      for (const g of sortedGroups) {
        groupStartCol[g] = colIdx;
        const subs = groupToSubgroups.get(g) || [];
        for (const sg of subs) {
          headerRow1.push(g);
          headerRow2.push(sg);
          headerRow3.push("Ngày/Tên hs");
          headerRow1.push(g);
          headerRow2.push(sg);
          headerRow3.push("Số lượt");
          colIdx += 2;
        }
        // Group-level Điểm trừ column
        headerRow1.push(g);
        headerRow2.push("Điểm trừ");
        headerRow3.push(null);
        colIdx += 1;
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
      const lastStart = cursor;
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
      const totals = classEntries.map(([id, d]) => d.totalPoints);
      const sortedTotals = Array.from(
        new Set(totals.slice().sort((a, b) => b - a))
      );
      const rankByTotal = new Map<number, number>();
      sortedTotals.forEach((t, i) => rankByTotal.set(t, i + 1));

      for (const [clsId, data] of classEntries) {
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
    } catch (e: any) {
      console.error(e);
      toast.error("Xuất báo cáo thất bại: " + (e?.message || ""));
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
          <p className="text-sm text-muted-foreground mt-1">
            Tạo báo cáo tổng hợp vi phạm theo khối và khoảng thời gian
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
