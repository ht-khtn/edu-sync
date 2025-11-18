"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";

type Option = { id: string; name: string };

interface FiltersProps {
  initial: {
    classId: string;
    studentId: string;
    criteriaId: string;
    start: string;
    end: string;
  };
  classes: Option[];
  students: Option[];
  criteria: Option[];
}

function FiltersComponent({
  initial,
  classes,
  students,
  criteria,
}: FiltersProps) {
  const router = useRouter();
  const [classId, setClassId] = useState(initial.classId);
  const [studentId, setStudentId] = useState(initial.studentId);
  const [criteriaId, setCriteriaId] = useState(initial.criteriaId);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [studentSearch, setStudentSearch] = useState("");

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const search = studentSearch.toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(search));
  }, [students, studentSearch]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId),
    [students, studentId]
  );

  const apply = useCallback(() => {
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    if (studentId) params.set("studentId", studentId);
    if (criteriaId) params.set("criteriaId", criteriaId);
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const q = params.toString();
    router.push(
      q ? `/admin/violation-history?${q}` : "/admin/violation-history"
    );
  }, [classId, studentId, criteriaId, start, end, router]);

  const clearAll = useCallback(() => {
    setClassId("");
    setStudentId("");
    setCriteriaId("");
    setStart("");
    setEnd("");
    setStudentSearch("");
    router.push("/admin/violation-history");
  }, [router]);

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-6">
        <div className="space-y-4" suppressHydrationWarning>
          {/* Student Search */}
          <div className="space-y-2" suppressHydrationWarning>
            <Label htmlFor="student-search" className="text-sm font-medium">
              Tìm học sinh
            </Label>
            <div className="relative" suppressHydrationWarning>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="student-search"
                type="text"
                placeholder="Nhập tên học sinh..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-9 h-10"
              />
              {studentSearch && (
                <button
                  onClick={() => setStudentSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {studentSearch && (
              <div
                className="border rounded-md max-h-48 overflow-y-auto bg-background shadow-sm"
                suppressHydrationWarning
              >
                {filteredStudents.length > 0 ? (
                  <div className="divide-y" suppressHydrationWarning>
                    {filteredStudents.slice(0, 50).map((s) => (
                      <Button
                        key={s.id}
                        onClick={() => {
                          setStudentId(s.id);
                          setStudentSearch("");
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                          studentId === s.id ? "bg-primary/5" : ""
                        }`}
                        type="button"
                      >
                        {s.name}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                    suppressHydrationWarning
                  >
                    Không tìm thấy
                  </div>
                )}
              </div>
            )}
            {selectedStudent && !studentSearch && (
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm"
                suppressHydrationWarning
              >
                <span>{selectedStudent.name}</span>
                <Button
                  onClick={() => setStudentId("")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Other Filters */}
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            suppressHydrationWarning
          >
            <div className="space-y-2" suppressHydrationWarning>
              <Label htmlFor="filter-class" className="text-sm font-medium">
                Lớp
              </Label>
              <Select
                value={classId || undefined}
                onValueChange={(v) => setClassId(v ?? "")}
              >
                <SelectTrigger id="filter-class" className="h-10">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2" suppressHydrationWarning>
              <Label htmlFor="filter-criteria" className="text-sm font-medium">
                Loại vi phạm
              </Label>
              <Select
                value={criteriaId || undefined}
                onValueChange={(v) => setCriteriaId(v ?? "")}
              >
                <SelectTrigger id="filter-criteria" className="h-10">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  {criteria.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2" suppressHydrationWarning>
              <Label htmlFor="filter-start" className="text-sm font-medium">
                Từ ngày
              </Label>
              <Input
                id="filter-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-2" suppressHydrationWarning>
              <Label htmlFor="filter-end" className="text-sm font-medium">
                Đến ngày
              </Label>
              <Input
                id="filter-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {/* Actions */}
          <div
            className="flex items-center gap-2 pt-2 justify-end"
            suppressHydrationWarning
          >
            <Button onClick={apply} size="sm">
              Áp dụng
            </Button>
            <Button variant="outline" onClick={clearAll} size="sm">
              Xóa bộ lọc
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default FiltersComponent;
