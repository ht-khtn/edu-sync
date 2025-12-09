"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import type { Criteria } from "@/lib/violations";
import { cn } from "@/utils/cn";
import { EditCriteriaDialog } from "./EditCriteriaDialog";
import { CriteriaRowActions } from "./CriteriaRowActions";
import { CriteriaDetail, useCriteriaDetail } from "./CriteriaDetail";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<Set<string>>(new Set());

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const toggleSubgroup = (key: string) => {
    setCollapsedSubgroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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
    <div className="space-y-6">
      {groupedList.map((groupData) => {
        const isGroupCollapsed = collapsedGroups.has(groupData.group);
        const totalItems = Array.from(groupData.subgroups.values()).reduce((sum, items) => sum + items.length, 0);
        
        return (
          <div key={groupData.group} className="bg-background rounded-lg border shadow-sm overflow-hidden">
            {/* Group header with collapse button */}
            <div className="px-6 py-4 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/20 font-semibold text-base flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-primary/20"
                  onClick={() => toggleGroup(groupData.group)}
                  title={isGroupCollapsed ? "Mở rộng" : "Thu gọn"}
                >
                  {isGroupCollapsed ? (
                    <ChevronRight className="h-5 w-5 text-primary" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-primary" />
                  )}
                </Button>
                <span className="text-primary">{groupData.group}</span>
              </div>
              <span className="text-xs bg-primary/15 text-primary px-3 py-1 rounded-full font-medium">
                {totalItems} tiêu chí
              </span>
            </div>

            {/* Subgroups - only show if group is not collapsed */}
            {!isGroupCollapsed && (
              <div className="divide-y">
                {Array.from(groupData.subgroups.entries()).map(([subgroup, subgroupCriteria]) => {
                  const subgroupKey = `${groupData.group}-${subgroup}`;
                  const isSubgroupCollapsed = collapsedSubgroups.has(subgroupKey);
                  
                  return (
                    <div key={subgroupKey}>
                      {subgroup !== "—" && (
                        <div className="px-6 py-3 bg-muted/30 border-b-0 text-sm text-muted-foreground font-medium flex items-center justify-between hover:bg-muted/40 transition-colors">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 hover:bg-muted/50"
                              onClick={() => toggleSubgroup(subgroupKey)}
                              title={isSubgroupCollapsed ? "Mở rộng" : "Thu gọn"}
                            >
                              {isSubgroupCollapsed ? (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <span>{subgroup}</span>
                          </div>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                            {subgroupCriteria.length}
                          </span>
                        </div>
                      )}

                      {/* Only show table if subgroup is not collapsed */}
                      {!isSubgroupCollapsed && (
                        <div className="overflow-x-auto">
                          <Table className="min-w-[900px]">
                            <TableBody>
                              {subgroupCriteria.map((row) => (
                                <TableRow
                                  key={row.id}
                                  className="hover:bg-accent/50 cursor-pointer transition-colors"
                                  onClick={(e) => {
                                    const target = e.target as HTMLElement;
                                    if (!target.closest("button")) {
                                      openDetail(row);
                                    }
                                  }}
                                >
                                  <TableCell className="min-w-[220px] py-4 pl-8">
                                    <div className="space-y-1">
                                      <div className="max-w-[280px] truncate font-medium" title={row.name}>
                                        {row.name}
                                      </div>
                                      {row.description && (
                                        <div
                                          className="text-muted-foreground max-w-[280px] truncate text-xs"
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
                                    <span className="bg-destructive/10 text-destructive inline-flex items-center justify-center rounded-md px-2.5 py-1 text-sm font-semibold">
                                      -{Math.abs(row.points)}
                                    </span>
                                  </TableCell>

                                  <TableCell className="min-w-[130px] py-4">
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

                                  <TableCell className="min-w-[100px] py-4 text-right pr-6">
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
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Dialog chi tiết */}
      {selectedCriteria && (
        <CriteriaDetail criteria={selectedCriteria} open={isOpen} onOpenChange={setIsOpen} />
      )}
    </div>
  );
}
