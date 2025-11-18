"use client";
import React, { useState, useCallback } from "react";
import CSVUploader from "@/components/score/CSVUploader";
import ScorePreviewTable from "@/components/score/ScorePreviewTable";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
import { ParsedRow } from "@/lib/csv";
import { submitBatchMock } from "@/lib/score";

export default function ScoreEntryClient() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [activityId, setActivityId] = useState<string>("activity-demo-1");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = useCallback(async () => {
    if (!rows.length) return;
    setSubmitting(true);
    setResult(null);
    try {
      const resp = await submitBatchMock({
        batch_id: (crypto as any).randomUUID?.() ?? `batch-${Date.now()}`,
        activity_id: activityId,
        entries: rows,
      });
      setResult(resp);
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setSubmitting(false);
    }
  }, [rows, activityId]);

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-xl font-semibold">
            Thiết lập batch
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="activity-select">Chọn hoạt động</Label>
              <Select value={activityId} onValueChange={setActivityId}>
                <SelectTrigger id="activity-select">
                  <SelectValue placeholder="Chọn hoạt động" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activity-demo-1">
                    Hoạt động: Vệ sinh lớp - 2025
                  </SelectItem>
                  <SelectItem value="activity-demo-2">
                    Hoạt động: Tình nguyện - 2025
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-note">Tùy chọn khác</Label>
              <Input id="batch-note" placeholder="Ghi chú batch (tùy chọn)" />
            </div>
          </div>

          <CSVUploader onParsed={setRows} />
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button variant="outline" size="sm">
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || rows.length === 0}
            size="sm"
          >
            {submitting ? "Đang gửi..." : "Gửi batch"}
          </Button>
        </CardFooter>
      </Card>

      {rows.length > 0 && (
        <div className="mt-6">
          <ScorePreviewTable rows={rows} setRows={setRows} />
        </div>
      )}

      {result && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </>
  );
}
