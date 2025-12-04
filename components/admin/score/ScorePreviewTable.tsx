"use client"
import React from "react";
import { ParsedRow } from "@/lib/csv";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  rows: ParsedRow[];
  setRows: (r: ParsedRow[]) => void;
};

export default function ScorePreviewTable({ rows, setRows }: Props) {
  function updateRow(idx: number, patch: Partial<ParsedRow>) {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setRows(next);
  }

  if (!rows || rows.length === 0) return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <section className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="border px-2 py-1">#</th>
                <th className="border px-2 py-1">student_code</th>
                <th className="border px-2 py-1">points</th>
                <th className="border px-2 py-1">reason</th>
                <th className="border px-2 py-1">status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{i + 1}</td>
                  <td className="border px-2 py-1">{r.student_code ?? r.student_id ?? "-"}</td>
                  <td className="border px-2 py-1">
                    <Input
                      type="number"
                      value={String(r.points ?? "")}
                      onChange={(e) => updateRow(i, { points: Number((e.target as HTMLInputElement).value) })}
                      className="w-20"
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <Input
                      value={r.reason ?? ""}
                      onChange={(e) => updateRow(i, { reason: (e.target as HTMLInputElement).value })}
                      className="w-64"
                    />
                  </td>
                  <td className="border px-2 py-1 text-sm text-slate-600">{r._invalid ? `Invalid: ${r._invalid_msg}` : "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </CardContent>
    </Card>
  );
}
