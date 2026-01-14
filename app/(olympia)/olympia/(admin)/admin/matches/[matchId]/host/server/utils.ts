import type { PlayerSummary, RoundQuestionRow } from "./types";

export function normalizePlayerSummary(
  value: PlayerSummary | PlayerSummary[] | null | undefined
): PlayerSummary | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function getMetaCode(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  const code = meta.code;
  return typeof code === "string" && code.trim() ? code : null;
}

export function getRoundQuestionLabel(
  q: Pick<RoundQuestionRow, "id" | "question_set_item_id" | "meta">
): string {
  return getMetaCode(q.meta) ?? q.question_set_item_id ?? q.id;
}

export function getKhoiDongCodeInfo(
  code: string | null
): { kind: "personal"; seat: number } | { kind: "common" } | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;

  if (trimmed.startsWith("DKA-")) {
    return { kind: "common" };
  }

  // KD{seat}-{stt}
  const m = /^KD(\d+)-/i.exec(trimmed);
  if (!m) return null;
  const seat = Number(m[1]);
  if (!Number.isFinite(seat)) return null;
  return { kind: "personal", seat };
}

export function getVeDichSeatFromOrderIndex(orderIndex: unknown): number | null {
  const n = typeof orderIndex === "number" ? orderIndex : Number(orderIndex);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 12) return null;
  const seat = Math.floor((n - 1) / 3) + 1;
  return seat >= 1 && seat <= 4 ? seat : null;
}
