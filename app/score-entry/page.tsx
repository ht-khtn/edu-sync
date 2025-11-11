import React from "react";
import CSVUploader from "@/components/score/CSVUploader";
import ScorePreviewTable from "@/components/score/ScorePreviewTable";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ParsedRow } from "@/lib/csv";
import { submitBatchMock } from "@/lib/score";
import { useState } from "react";

export default function ScoreEntryPage() {
  // page is a server component but uses client components for interactivity
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [activityId, setActivityId] = useState<string>("activity-demo-1");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleSubmit() {
    if (!rows.length) return;
    setSubmitting(true);
    setResult(null);
    try {
      const resp = await submitBatchMock({
        batch_id: crypto.randomUUID?.() ?? `batch-${Date.now()}`,
        activity_id: activityId,
        entries: rows,
      });
      setResult(resp);
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Nhập điểm (Score Entry) - MVP</h1>

      <Card>
        <CardHeader>
          <CardTitle>Thiết lập batch</CardTitle>
        </CardHeader>
        <CardContent>
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <section>
              <Label className="mb-1">Chọn hoạt động</Label>
              <select
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
                className="border px-3 py-2 rounded w-full"
              >
                <option value="activity-demo-1">Hoạt động: Vệ sinh lớp - 2025</option>
                <option value="activity-demo-2">Hoạt động: Tình nguyện - 2025</option>
              </select>
            </section>

            <section>
              <Label className="mb-1">Tùy chọn khác</Label>
              <Input placeholder="Ghi chú batch (tùy chọn)" />
            </section>
          </section>

          <section className="mt-4">
            <CSVUploader onParsed={setRows} />
          </section>
        </CardContent>

        <CardFooter>
          <footer className="w-full flex items-center justify-end gap-3">
            <Button variant="outline" size="sm">Hủy</Button>
            <Button onClick={handleSubmit} disabled={submitting || rows.length === 0} size="sm">
              {submitting ? "Đang gửi..." : "Gửi batch"}
            </Button>
          </footer>
        </CardFooter>
      </Card>

      <section className="mt-6">
        <ScorePreviewTable rows={rows} setRows={setRows} />
      </section>

      <section className="mt-4">
        {result && <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>}
      </section>
    </main>
  );
}
