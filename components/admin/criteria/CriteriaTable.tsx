"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Criteria } from "@/lib/violations";
import { cn } from "@/utils/cn";
import { EditCriteriaDialog } from "./EditCriteriaDialog";
import { CriteriaRowActions } from "./CriteriaRowActions";
import { CriteriaDetail, useCriteriaDetail } from "./CriteriaDetail";

type Props = {
  rows: Criteria[];
};

const typeColor: Record<string, string> = {
  normal:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  serious:
    "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800",
  critical:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
};

export function CriteriaTable({ rows }: Props) {
  const { selectedCriteria, isOpen, openDetail, setIsOpen } = useCriteriaDetail();

  if (!rows.length) {
    return (
      <div className="bg-background text-muted-foreground rounded-lg border p-8 text-center">
        <p className="text-base">Chưa có tiêu chí nào phù hợp với bộ lọc.</p>
      </div>
    );
  }

  return (
    <div className="bg-background w-full overflow-hidden rounded-xl border shadow-sm">
      <div className="overflow-x-auto">
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
              <TableHead className="h-12 w-[18%] min-w-[180px] font-semibold">
                Tên tiêu chí
              </TableHead>
              <TableHead className="h-12 w-[22%] min-w-[220px] font-semibold">Mô tả</TableHead>
              <TableHead className="h-12 w-[10%] min-w-[110px] font-semibold">Mức độ</TableHead>
              <TableHead className="h-12 w-[8%] min-w-20 text-center font-semibold">Điểm</TableHead>
              <TableHead className="h-12 w-[12%] min-w-[120px] font-semibold">Nhóm</TableHead>
              <TableHead className="h-12 w-[10%] min-w-[110px] font-semibold">Phạm vi</TableHead>
              <TableHead className="h-12 w-[10%] min-w-[110px] font-semibold">Trạng thái</TableHead>
              <TableHead className="h-12 w-[10%] min-w-[130px] text-right font-semibold">
                Thao tác
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={(e) => {
                  // Không mở detail nếu click vào button actions
                  const target = e.target as HTMLElement;
                  if (!target.closest("button")) {
                    openDetail(row);
                  }
                }}
              >
                <TableCell className="min-w-[180px] py-4">
                  <div className="space-y-1">
                    <div className="max-w-[200px] truncate font-medium" title={row.name}>
                      {row.name}
                    </div>
                    {row.subgroup && (
                      <div
                        className="text-muted-foreground max-w-[200px] truncate text-xs"
                        title={row.subgroup}
                      >
                        {row.subgroup}
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell className="min-w-[220px] py-4">
                  <p
                    className="text-muted-foreground line-clamp-2 max-w-[280px] text-sm leading-relaxed"
                    title={row.description || "—"}
                  >
                    {row.description || <span className="text-muted-foreground/50">—</span>}
                  </p>
                </TableCell>

                <TableCell className="min-w-[110px] py-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium whitespace-nowrap",
                      typeColor[row.type || "normal"] || "bg-muted"
                    )}
                  >
                    {row.type === "normal" && "Thông thường"}
                    {row.type === "serious" && "Nghiêm trọng"}
                    {row.type === "critical" && "Rất nghiêm trọng"}
                  </Badge>
                </TableCell>

                <TableCell className="min-w-20 py-4 text-center">
                  <span className="bg-muted inline-flex items-center justify-center rounded-md px-2.5 py-1 text-sm font-semibold">
                    {Math.abs(row.points)}
                  </span>
                </TableCell>

                <TableCell className="min-w-[120px] py-4">
                  <div className="max-w-[140px] truncate text-sm" title={row.group || "—"}>
                    {row.group || <span className="text-muted-foreground/50">—</span>}
                  </div>
                </TableCell>

                <TableCell className="min-w-[110px] py-4">
                  <Badge
                    variant="outline"
                    className="border-primary/20 bg-primary/5 text-primary font-medium whitespace-nowrap"
                  >
                    {row.category === "class" ? "Tập thể" : "Học sinh"}
                  </Badge>
                </TableCell>

                <TableCell className="min-w-[110px] py-4">
                  {row.isActive ? (
                    <Badge
                      className="border-green-200 bg-green-50 font-medium whitespace-nowrap text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300"
                      variant="outline"
                    >
                      Đang dùng
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-medium whitespace-nowrap">
                      Ngưng dùng
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="min-w-[130px] py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditCriteriaDialog criteria={row} />
                    <CriteriaRowActions criteria={row} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog chi tiết */}
      {selectedCriteria && (
        <CriteriaDetail criteria={selectedCriteria} open={isOpen} onOpenChange={setIsOpen} />
      )}
    </div>
  );
}
