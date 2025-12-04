"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Criteria } from "@/lib/violations";
import { cn } from "@/utils/cn";

type Props = {
  criteria: Criteria;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const typeColor: Record<string, string> = {
  normal:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  serious:
    "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800",
  critical:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
};

const typeLabel: Record<string, string> = {
  normal: "Bình thường",
  serious: "Nghiêm trọng",
  critical: "Rất nghiêm trọng",
};

export function CriteriaDetail({ criteria, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Chi tiết tiêu chí</DialogTitle>
          <DialogDescription>Thông tin đầy đủ về tiêu chí vi phạm</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Tên tiêu chí */}
          <div className="space-y-2">
            <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Tên tiêu chí
            </h3>
            <p className="text-lg font-semibold">{criteria.name}</p>
            {criteria.subgroup && (
              <p className="text-muted-foreground text-sm">
                Nhóm con: <span className="font-medium">{criteria.subgroup}</span>
              </p>
            )}
          </div>

          <Separator />

          {/* Mô tả */}
          <div className="space-y-2">
            <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Mô tả
            </h3>
            <p className="text-sm leading-relaxed">
              {criteria.description || (
                <span className="text-muted-foreground italic">Không có mô tả</span>
              )}
            </p>
          </div>

          <Separator />

          {/* Thông tin chi tiết */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Mức độ */}
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Mức độ vi phạm
              </h3>
              <Badge
                variant="outline"
                className={cn(
                  "px-3 py-1 text-sm font-medium",
                  typeColor[criteria.type || "normal"]
                )}
              >
                {typeLabel[criteria.type || "normal"] || criteria.type}
              </Badge>
            </div>

            {/* Điểm */}
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Điểm trừ
              </h3>
              <div className="bg-muted inline-flex items-center justify-center rounded-lg px-4 py-2">
                <span className="text-2xl font-bold">{Math.abs(criteria.points)}</span>
                <span className="text-muted-foreground ml-1 text-sm">điểm</span>
              </div>
            </div>

            {/* Phạm vi */}
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Phạm vi áp dụng
              </h3>
              <Badge
                variant="outline"
                className="border-primary/20 bg-primary/5 text-primary px-3 py-1 text-sm font-medium"
              >
                {criteria.category === "class" ? "Tập thể" : "Học sinh"}
              </Badge>
            </div>

            {/* Trạng thái */}
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Trạng thái
              </h3>
              {criteria.isActive ? (
                <Badge
                  className="border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300"
                  variant="outline"
                >
                  Đang sử dụng
                </Badge>
              ) : (
                <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
                  Ngưng sử dụng
                </Badge>
              )}
            </div>
          </div>

          {/* Nhóm */}
          {criteria.group && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                  Nhóm tiêu chí
                </h3>
                <p className="text-sm font-medium">{criteria.group}</p>
              </div>
            </>
          )}

            {/* Mã tiêu chí */}
          <Separator />
          <div className="space-y-2">
            <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Phạm vi
            </h3>
            <code className="bg-muted rounded px-2 py-1 font-mono text-xs">
              {criteria.code || criteria.id}
            </code>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook để sử dụng trong CriteriaTable
export function useCriteriaDetail() {
  const [selectedCriteria, setSelectedCriteria] = useState<Criteria | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openDetail = (criteria: Criteria) => {
    setSelectedCriteria(criteria);
    setIsOpen(true);
  };

  const closeDetail = () => {
    setIsOpen(false);
  };

  return {
    selectedCriteria,
    isOpen,
    openDetail,
    closeDetail,
    setIsOpen,
  };
}
