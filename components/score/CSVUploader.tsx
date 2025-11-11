"use client"
import React from "react";
import { parseCSV } from "@/lib/csv";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  onParsed: (rows: any[]) => void;
};

export default function CSVUploader({ onParsed }: Props) {
  async function handleFileText(text: string) {
    try {
      const rows = parseCSV(text);
      onParsed(rows);
    } catch (err) {
      console.error("CSV parse error", err);
      window.alert("Lỗi khi phân tích file CSV: " + String(err));
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await handleFileText(text);
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const text = await file.text();
    await handleFileText(text);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tải file CSV</CardTitle>
      </CardHeader>
      <CardContent>
        <Label className="mb-2">Tải file CSV hoặc chọn từ máy</Label>
        <section
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex items-center gap-3"
        >
          <input id="csv-file-input" type="file" accept=".csv" onChange={handleFile} />
          <Button variant="ghost" size="sm" asChild>
            <label htmlFor="csv-file-input" className="cursor-pointer">Chọn file</label>
          </Button>
          <div className="text-sm text-muted-foreground">Hoặc kéo file vào đây</div>
        </section>
        <p className="text-sm text-slate-500 mt-2">Expect headers: student_code OR student_id, points, reason (optional)</p>
      </CardContent>
    </Card>
  );
}
