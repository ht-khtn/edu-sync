/**
 * Shared trace and performance utilities for Olympia server actions.
 * Centralizes duplicated functions from realtime.actions.ts, scoring.actions.ts, etc.
 */

import { randomBytes } from "crypto";

export const OLYMPIA_ACTION_PERF_TRACE = process.env.OLYMPIA_PERF_TRACE === "1";

export const OLYMPIA_ACTION_TRACE =
  process.env.OLYMPIA_TRACE === "1" || process.env.OLYMPIA_PERF_TRACE === "1";

export type OlympiaTraceFields = Record<string, string | number | boolean | null>;

export function utf8ByteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

export function estimateFormDataPayloadBytes(formData: FormData): number {
  let total = 0;
  for (const [key, value] of formData.entries()) {
    total += utf8ByteLength(key);
    if (typeof value === "string") {
      total += utf8ByteLength(value);
      continue;
    }

    // File/Blob: chỉ ước lượng metadata + size, không đọc nội dung.
    total += utf8ByteLength(value.name);
    total += utf8ByteLength(value.type);
    total += value.size;
  }
  return total;
}

export function readStringFormField(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function getOrCreateTraceId(formData: FormData): string {
  const provided = readStringFormField(formData, "traceId");
  if (provided) return provided;
  // Dùng randomBytes để tránh phụ thuộc crypto.randomUUID trên mọi runtime.
  return randomBytes(8).toString("hex");
}

export function traceInfo(params: {
  traceId: string;
  action: string;
  event: string;
  fields?: OlympiaTraceFields;
}): void {
  if (!OLYMPIA_ACTION_TRACE) return;
  const { traceId, action, event, fields } = params;
  const payload = {
    layer: "server",
    traceId,
    action,
    event,
    ts: new Date().toISOString(),
    payloadBytes: typeof fields?.payloadBytes === "number" ? fields.payloadBytes : 0,
    ...(fields ?? {}),
  };
  console.info("[Olympia][Trace]", JSON.stringify(payload));
}

export function makePerfId(): string {
  // Tránh đụng label khi có nhiều request song song.
  return `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export async function perfAction<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!OLYMPIA_ACTION_PERF_TRACE) return await fn();
  const perfId = makePerfId();
  const fullLabel = `${label} ${perfId}`;
  console.time(fullLabel);
  try {
    return await fn();
  } finally {
    console.timeEnd(fullLabel);
  }
}
