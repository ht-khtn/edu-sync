import { ParsedRow } from "./csv";

type SubmitPayload = {
  batch_id: string;
  activity_id: string;
  entries: ParsedRow[];
};

// Mock submit - simulates network request and returns per-row results
export async function submitBatchMock(payload: SubmitPayload) {
  // simulate network / server processing delay
  await new Promise((r) => setTimeout(r, 800));

  const results = payload.entries.map((row, idx) => ({
    row_index: idx,
    status: row._invalid ? "failed" : "created",
    score_id: row._invalid ? null : `score-${Math.random().toString(36).slice(2, 9)}`,
    error: row._invalid ? row._invalid_msg : null,
  }));

  const summary = {
    total: payload.entries.length,
    created: results.filter((r) => r.status === "created").length,
    failed: results.filter((r) => r.status === "failed").length,
  };

  return {
    batch_id: payload.batch_id,
    summary,
    results,
  };
}
