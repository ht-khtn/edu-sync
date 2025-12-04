"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CRITERIA_CATEGORY_OPTIONS,
  CRITERIA_STATUS_OPTIONS,
  CRITERIA_TYPE_OPTIONS,
} from "./constants";

export type CriteriaFilterState = {
  q?: string;
  category?: string;
  type?: string;
  status?: string;
};

export function CriteriaFilters({ initial }: { initial: CriteriaFilterState }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [type, setType] = useState(initial.type ?? "");
  const [status, setStatus] = useState(initial.status ?? "");
  const ALL_VALUE = "__all__";

  const applyFilters = (event?: React.FormEvent) => {
    event?.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams();
      if (q.trim().length > 0) params.set("q", q.trim());
      if (category) params.set("category", category);
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      const query = params.toString();
      router.replace(query ? `/admin/criteria?${query}` : "/admin/criteria", { scroll: false });
    });
  };

  const resetFilters = () => {
    setQ("");
    setCategory("");
    setType("");
    setStatus("");
    startTransition(() => {
      router.replace("/admin/criteria", { scroll: false });
    });
  };

  return (
    <div className="bg-card rounded-xl border p-6 shadow-sm">
      <form className="space-y-4" onSubmit={applyFilters}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-muted-foreground text-sm font-medium">Tìm kiếm</label>
            <Input
              placeholder="Nhập tên, mô tả hoặc nhóm..."
              value={q}
              onChange={(event) => setQ(event.target.value)}
              disabled={isPending}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-sm font-medium">Phạm vi</label>
            <Select
              value={category || ALL_VALUE}
              onValueChange={(value) => setCategory(value === ALL_VALUE ? "" : value)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Chọn phạm vi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tất cả phạm vi</SelectItem>
                {CRITERIA_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-sm font-medium">Mức độ</label>
            <Select
              value={type || ALL_VALUE}
              onValueChange={(value) => setType(value === ALL_VALUE ? "" : value)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Chọn mức độ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tất cả mức độ</SelectItem>
                {CRITERIA_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-sm font-medium">Trạng thái</label>
            <Select
              value={status || ALL_VALUE}
              onValueChange={(value) => setStatus(value === ALL_VALUE ? "" : value)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tất cả trạng thái</SelectItem>
                {CRITERIA_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={resetFilters}
            disabled={isPending}
            className="h-10 sm:w-auto"
          >
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Đặt lại
          </Button>
          <Button type="submit" disabled={isPending} className="h-10 sm:w-auto">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            {isPending ? "Đang lọc..." : "Áp dụng bộ lọc"}
          </Button>
        </div>
      </form>
    </div>
  );
}
