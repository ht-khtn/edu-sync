import React from "react";
import ScoreEntryClient from "@/components/score/ScoreEntryClient";

export default function ScoreEntryPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Nhập điểm (Score Entry) - MVP</h1>
      <ScoreEntryClient />
    </main>
  );
}

