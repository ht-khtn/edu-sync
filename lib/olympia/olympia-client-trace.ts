/**
 * Shared client-side trace utilities for Olympia components.
 * Centralizes duplicated functions from OlympiaGameClient.tsx and HostRealtimeEventsListener.tsx.
 */

export const OLYMPIA_CLIENT_TRACE = process.env.NEXT_PUBLIC_OLYMPIA_TRACE === "1";

export type OlympiaClientTraceFields = Record<string, string | number | boolean | null>;

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
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

export function estimateJsonPayloadBytes(value: object | null): number {
  if (!value) return 0;
  try {
    return utf8ByteLength(JSON.stringify(value));
  } catch {
    return 0;
  }
}

export function createClientTraceId(): string {
  // Dùng Date.now + Math.random để tạo ID đủ unique cho tracing.
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function traceClient(params: {
  traceId: string;
  action: string;
  event: string;
  fields?: OlympiaClientTraceFields;
}): void {
  if (!OLYMPIA_CLIENT_TRACE) return;
  const { traceId, action, event, fields } = params;
  const payload = {
    layer: "client",
    traceId,
    action,
    event,
    ts: new Date().toISOString(),
    ...(fields ?? {}),
  };
  console.info("[Olympia][Client][Trace]", JSON.stringify(payload));
}

export function getReceiveLagMs(commitTimestamp: string | null | undefined): number | null {
  if (!commitTimestamp) return null;
  const commitMs = Date.parse(commitTimestamp);
  if (!Number.isFinite(commitMs)) return null;
  return Date.now() - commitMs;
}

export function traceHostReceive(params: { event: string; fields: OlympiaClientTraceFields }): void {
  if (!OLYMPIA_CLIENT_TRACE) return;
  const { event, fields } = params;
  const payload = {
    layer: "client",
    event,
    ts: new Date().toISOString(),
    ...(fields ?? {}),
  };
  console.info("[Olympia][Host][Trace]", JSON.stringify(payload));
}
