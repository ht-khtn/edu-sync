"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type AggRow = { id: string; name: string; total: number; count: number };

const STORAGE_KEY = "violationStats.settings";

function ClassAggClientComponent({ classAgg }: { classAgg: AggRow[] }) {
  const [useBase, setUseBase] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.useBase === "boolean") return parsed.useBase;
      }
    } catch {
      // ignore
    }
    return false;
  });

  const [baseScoreStr, setBaseScoreStr] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.baseScoreStr === "string") return parsed.baseScoreStr;
      }
    } catch {
      // ignore
    }
    return "500";
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ useBase, baseScoreStr })
      );
    } catch {
      // ignore
    }
  }, [useBase, baseScoreStr]);

  const baseScore = useMemo(() => Number(baseScoreStr) || 0, [baseScoreStr]);

  const handleBaseScoreChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBaseScoreStr(e.target.value);
      setUseBase(true);
    },
    []
  );

  const displayedRows = useMemo(() => {
    return classAgg.map((c) => {
      const totalDeduction = Math.abs(Number(c.total || 0));
      const displayed = useBase ? baseScore - totalDeduction : totalDeduction;
      return { ...c, displayed };
    });
  }, [classAgg, useBase, baseScore]);

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <Card className="bg-primary/65 border-primary">
        <div className="p-4 space-y-4" suppressHydrationWarning>
          <div className="flex items-start gap-3" suppressHydrationWarning>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-foreground/10"
              suppressHydrationWarning
            >
              <Info className="h-4 w-4 text-accent-foreground" />
            </div>
            <div className="flex-1 space-y-3" suppressHydrationWarning>
              <div suppressHydrationWarning>
                <h3 className="font-semibold text-accent-foreground">
                  Tùy chỉnh hiển thị
                </h3>
                <p className="text-sm text-accent-foreground/80 mt-1">
                  Bật điểm cơ sở để hiển thị điểm cuối (điểm cơ sở - tổng điểm
                  trừ)
                </p>
              </div>

              <Separator className="bg-accent-foreground/20" />

              <div
                className="flex flex-col sm:flex-row gap-4"
                suppressHydrationWarning
              >
                <div
                  className="flex items-center gap-3"
                  suppressHydrationWarning
                >
                  <Switch
                    id="use-base-score"
                    checked={useBase}
                    onCheckedChange={(v) => setUseBase(Boolean(v))}
                    className="data-[state=checked]:bg-primary"
                  />
                  <Label
                    htmlFor="use-base-score"
                    className="text-sm font-medium text-accent-foreground cursor-pointer"
                  >
                    Sử dụng điểm cơ sở
                  </Label>
                </div>

                {useBase && (
                  <div
                    className="flex items-center gap-3"
                    suppressHydrationWarning
                  >
                    <Label
                      htmlFor="base-score-input"
                      className="text-sm font-medium text-accent-foreground whitespace-nowrap"
                    >
                      Điểm cơ sở:
                    </Label>
                    <Input
                      id="base-score-input"
                      value={baseScoreStr}
                      onChange={handleBaseScoreChange}
                      type="number"
                      className="w-28 h-9 bg-background"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div
        className="border rounded-lg overflow-hidden shadow-sm"
        suppressHydrationWarning
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Lớp</TableHead>
              <TableHead className="text-right font-semibold w-32">
                Số lần
              </TableHead>
              <TableHead className="text-right font-semibold w-32">
                {useBase ? "Điểm cuối" : "Tổng điểm trừ"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedRows.map((c, idx) => (
              <TableRow key={c.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <div
                    className="flex items-center gap-2"
                    suppressHydrationWarning
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {idx + 1}
                    </span>
                    {c.name}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.count}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-destructive">
                  {c.displayed}
                </TableCell>
              </TableRow>
            ))}
            {displayedRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-32 text-center text-muted-foreground"
                >
                  Chưa có dữ liệu theo lớp.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default React.memo(ClassAggClientComponent);
