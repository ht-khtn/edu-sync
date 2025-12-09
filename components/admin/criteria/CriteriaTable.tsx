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

type GroupedCriteria = {
  group: string;
  subgroups: Map<string, Criteria[]>;
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

  // Group criteria by group, then by subgroup
  const groupedMap = new Map<string, GroupedCriteria>();
  for (const criteria of rows) {
    const group = criteria.group || "Khác";
    if (!groupedMap.has(group)) {
      groupedMap.set(group, { group, subgroups: new Map() });
    }
    const groupData = groupedMap.get(group)!;
    const subgroup = criteria.subgroup || "—";
    if (!groupData.subgroups.has(subgroup)) {
      groupData.subgroups.set(subgroup, []);
    }
    groupData.subgroups.get(subgroup)!.push(criteria);
  }

  const groupedList = Array.from(groupedMap.values());
  // Sort groups
  groupedList.sort((a, b) => a.group.localeCompare(b.group));

  return (
    <div className="bg-background w-full overflow-hidden rounded-xl border shadow-sm space-y-4">
      {groupedList.map((groupData) => (
        <div key={groupData.group}>
          {/* Group header */}
          <div className="px-6 py-3 bg-muted/40 border-b font-semibold text-sm">
            {groupData.group}
          </div>

          {/* Subgroups */}
          {Array.from(groupData.subgroups.entries()).map(([subgroup, subgroupCriteria]) => (
            <div key={`${groupData.group}-${subgroup}`} className="overflow-x-auto">
              {subgroup !== "—" && (
                <div className="px-6 py-2 bg-muted/20 text-xs text-muted-foreground font-medium border-b">
                  {subgroup}
                </div>
              )}

              <Table className="min-w-[1000px]">
                {subgroup === "—" && groupData.subgroups.size === 1 && (
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                      <TableHead className="h-12 w-[25%] min-w-[200px] font-semibold">
                        Tên tiêu chí
                      </TableHead>
                      <TableHead className="h-12 w-[12%] min-w-[110px] font-semibold">Mức độ</TableHead>
                      <TableHead className="h-12 w-[10%] min-w-20 text-center font-semibold">Điểm</TableHead>
                      <TableHead className="h-12 w-[15%] min-w-[120px] font-semibold">Phạm vi</TableHead>
                      <TableHead className="h-12 w-[12%] min-w-[110px] font-semibold">Trạng thái</TableHead>
                      <TableHead className="h-12 w-[10%] min-w-[100px] text-right font-semibold">
                        Thao tác
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                )}
                {!(subgroup === "—" && groupData.subgroups.size === 1) && (
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                      <TableHead className="h-12 w-[25%] min-w-[200px] font-semibold">
                        Tên tiêu chí
                      </TableHead>
                      <TableHead className="h-12 w-[12%] min-w-[110px] font-semibold">Mức độ</TableHead>
                      <TableHead className="h-12 w-[10%] min-w-20 text-center font-semibold">Điểm</TableHead>
                      <TableHead className="h-12 w-[15%] min-w-[120px] font-semibold">Phạm vi</TableHead>
                      <TableHead className="h-12 w-[12%] min-w-[110px] font-semibold">Trạng thái</TableHead>
                      <TableHead className="h-12 w-[10%] min-w-[100px] text-right font-semibold">
                        Thao tác
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                )}

                <TableBody>
                  {subgroupCriteria.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (!target.closest("button")) {
                          openDetail(row);
                        }
                      }}
                    >
                      <TableCell className="min-w-[200px] py-4">
                        <div className="space-y-1">
                          <div className="max-w-[250px] truncate font-medium" title={row.name}>
                            {row.name}
                          </div>
                          {row.description && (
                            <div
                              className="text-muted-foreground max-w-[250px] truncate text-xs"
                              title={row.description}
                            >
                              {row.description}
                            </div>
                          )}
                        </div>
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
                          -{Math.abs(row.points)}
                        </span>
                      </TableCell>

                      <TableCell className="min-w-[120px] py-4">
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

                      <TableCell className="min-w-[100px] py-4 text-right">
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
          ))}
        </div>
      ))}

      {/* Dialog chi tiết */}
      {selectedCriteria && (
        <CriteriaDetail criteria={selectedCriteria} open={isOpen} onOpenChange={setIsOpen} />
      )}
    </div>
  );
}
