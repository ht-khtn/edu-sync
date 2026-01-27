"use server";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";
import { getServerAuthContext } from "@/lib/server-auth";
import { getCountdownMs, getVeDichCountdownMs } from "@/lib/olympia/olympia-config";
import {
  estimateFormDataPayloadBytes,
  getOrCreateTraceId,
  perfAction,
  readStringFormField,
  traceInfo,
} from "@/lib/olympia/olympia-trace";
import { requireOlympiaAdminContext } from "@/lib/olympia/olympia-auth";
import type { ActionState } from "./match.actions";

const advanceQuestionSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  direction: z.enum(["next", "prev"]).default("next"),
  durationMs: z.number().int().min(1000).max(120000).optional().default(5000),
  autoShow: z
    .string()
    .optional()
    .transform((val) => val === "1"),
});

const waitingScreenSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  enabled: z
    .string()
    .optional()
    .transform((val) => val === "1"),
});

const buzzerEnabledSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  enabled: z
    .string()
    .optional()
    .transform((val) => val === "1"),
});

const scoreboardOverlaySchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  enabled: z
    .string()
    .optional()
    .transform((val) => val === "1"),
});

const answersOverlaySchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  enabled: z
    .string()
    .optional()
    .transform((val) => val === "1"),
});

const endKhoiDongTurnSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
});

const roundControlSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
  roundId: z.string().uuid("Vòng không hợp lệ."),
  roundType: z.enum(["khoi_dong", "vcnv", "tang_toc", "ve_dich"]),
});

const questionStateSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
  questionState: z.enum(["hidden", "showing", "answer_revealed", "completed"]),
});

const startTimerSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  durationMs: z.number().int().min(1000).max(120000),
});

const submitAnswerSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  answer: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length > 0, "Vui lòng nhập đáp án.")
  ),
  notes: z.preprocess(
    (value) => (typeof value === "string" ? value : undefined),
    z
      .string()
      .optional()
      .transform((value) => (value && value.trim().length > 0 ? value.trim() : null))
  ),
});

const buzzerSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
});

const guestMediaControlSchema = z.object({
  matchId: z.preprocess(
    (val) => (typeof val === "string" ? val : ""),
    z.string().uuid("ID trận không hợp lệ.")
  ),
  mediaType: z.preprocess(
    (val) => (typeof val === "string" ? val : ""),
    z.enum(["audio", "video"], "Loại media không hợp lệ.")
  ),
  command: z.preprocess(
    (val) => (typeof val === "string" ? val : ""),
    z.enum(["play", "pause", "restart", "stop"], "Lệnh media không hợp lệ.")
  ),
  // Optional single src (absolute URL) or JSON encoded array string in mediaSrcs
  mediaSrc: z.preprocess(
    (val) => (typeof val === "string" ? val : undefined),
    z.string().optional()
  ),
  mediaSrcs: z.preprocess(
    (val) => (typeof val === "string" ? val : undefined),
    z.string().optional()
  ),
});

type GuestMediaCommand = {
  commandId: number;
  action: "play" | "pause" | "restart" | "stop";
  issuedAt: string;
  // Optional list of sources (absolute URLs) to set/play on guest
  srcs?: string[];
};

type GuestMediaControl = {
  version?: number;
  audio?: GuestMediaCommand;
  video?: GuestMediaCommand;
};

const setCurrentQuestionSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
  roundQuestionId: z.string().uuid("Câu hỏi không hợp lệ."),
  durationMs: z.number().int().min(1000).max(120000).optional().default(5000),
});

const startTimerAutoSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
});

const expireTimerSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
});

const veDichPackageSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
  playerId: z.string().uuid("Thí sinh không hợp lệ."),
  values: z
    .array(
      z
        .number()
        .int()
        .refine((v) => v === 20 || v === 30, "Gói chỉ nhận 20 hoặc 30.")
    )
    .length(3, "Cần chọn đủ 3 câu (20/30) theo thứ tự."),
});

type VeDichPackageValue = 20 | 30;

function getVeDichSeatFromOrderIndex(orderIndex: unknown): number | null {
  const n = typeof orderIndex === "number" ? orderIndex : Number(orderIndex);
  if (!Number.isFinite(n)) return null;
  // Convention: Về đích có 12 câu placeholder, chia 4 ghế * 3 câu.
  // order_index: 1..3 => ghế 1; 4..6 => ghế 2; 7..9 => ghế 3; 10..12 => ghế 4.
  if (n < 1 || n > 12) return null;
  const seat = Math.floor((n - 1) / 3) + 1;
  return seat >= 1 && seat <= 4 ? seat : null;
}

function getVeDichSlotRangeForSeat(seat: number): { start: number; end: number } {
  const start = (seat - 1) * 3 + 1;
  return { start, end: start + 2 };
}

function computeVeDichDurationMsFromMeta(meta: unknown): number {
  if (!meta || typeof meta !== "object") return getVeDichCountdownMs(20);
  const raw = (meta as Record<string, unknown>).ve_dich_value;
  const val = typeof raw === "number" ? raw : Number(raw);
  return getVeDichCountdownMs(val === 30 ? 30 : 20);
}

const setRoundQuestionTargetSchema = z.object({
  // Lưu ý: FormData.get() trả về null nếu field không tồn tại.
  // Cần preprocess để tránh Zod coi null là "Invalid input".
  matchId: z.preprocess(
    (val) => (typeof val === "string" ? val : ""),
    z.string().min(1, "Trận không hợp lệ.") // Allow any non-empty string (UUID, join_code, etc.)
  ),
  roundQuestionId: z.preprocess(
    (val) => (typeof val === "string" ? val : ""),
    z
      .union([z.string().uuid("Câu hỏi không hợp lệ."), z.literal("")])
      .transform((val) => (val ? val : null))
  ),
  // Cho phép bỏ chọn ("Thi chung") bằng cách gửi chuỗi rỗng.
  playerId: z.preprocess(
    (val) => (typeof val === "string" ? val : ""),
    z
      .union([z.string().uuid("Thí sinh không hợp lệ."), z.literal("")])
      .transform((val) => (val ? val : null))
  ),
  // Phân biệt trường hợp chọn thí sinh trước khi chọn câu (chỉ dùng cho Về đích).
  roundType: z.preprocess(
    (val) => (typeof val === "string" ? val : ""),
    z
      .union([z.enum(["khoi_dong", "vcnv", "tang_toc", "ve_dich"]), z.literal("")])
      .optional()
      .transform((val) => (val ? val : null))
  ),
});

// Helper để resolve matchId từ UUID, join_code, hoặc sessionId
async function resolveMatchIdFromRaw(
  supabase: SupabaseClient,
  raw: string
): Promise<string | null> {
  if (!raw) return null;

  const olympia = supabase.schema("olympia");

  function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  // Try as UUID first
  if (isUuid(raw)) {
    const { data: matchDirect } = await olympia
      .from("matches")
      .select("id")
      .eq("id", raw)
      .maybeSingle();
    if (matchDirect?.id) return matchDirect.id;

    // Try as sessionId
    const { data: sessionByIdOrJoin } = await olympia
      .from("live_sessions")
      .select("match_id")
      .or(`id.eq.${raw},join_code.eq.${raw}`)
      .maybeSingle();
    return (sessionByIdOrJoin as { match_id?: string | null } | null)?.match_id ?? null;
  }

  // Try as join_code
  const { data: sessionByJoin } = await olympia
    .from("live_sessions")
    .select("match_id")
    .eq("join_code", raw)
    .maybeSingle();
  return (sessionByJoin as { match_id?: string | null } | null)?.match_id ?? null;
}

function parseKhoiDongCodeInfoFromMeta(
  meta: unknown
): { kind: "personal"; seat: number } | { kind: "common" } | null {
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>).code;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  if (trimmed.startsWith("DKA-")) return { kind: "common" };
  const m = /^KD(\d+)-/i.exec(trimmed);
  if (!m) return null;
  const seat = Number(m[1]);
  if (!Number.isFinite(seat)) return null;
  return { kind: "personal", seat };
}

function normalizeAnswerForAutoCheck(input: string): string {
  // Mục tiêu: so khớp "gần đúng" cho đáp án dạng text (đặc biệt tiếng Việt)
  // - Không phân biệt hoa/thường
  // - Bỏ dấu tiếng Việt
  // - Chuẩn hoá khoảng trắng
  const raw = (input ?? "").toString().trim().toLowerCase();
  if (!raw) return "";
  const withoutDiacritics = raw
    .normalize("NFD")
    // remove combining marks
    .replace(/[\u0300-\u036f]/g, "")
    // Vietnamese đ/Đ
    .replace(/đ/g, "d");
  return withoutDiacritics.replace(/\s+/g, " ").trim();
}

function isAnswerCorrectLoose(params: { submitted: string; expected: string | null }): boolean {
  const submitted = normalizeAnswerForAutoCheck(params.submitted);
  if (!submitted) return false;
  const expectedRaw = (params.expected ?? "").toString().trim();
  if (!expectedRaw) return false;

  // Hỗ trợ nhiều đáp án trong DB: phân tách theo | ; \n
  const candidates = expectedRaw
    .split(/\||;|\n/g)
    .map((s) => normalizeAnswerForAutoCheck(s))
    .filter(Boolean);

  if (candidates.length === 0) return false;
  return candidates.some((c) => c === submitted);
}

export async function setLiveSessionRoundAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  return await perfAction("[perf][action] setLiveSessionRoundAction", async () => {
    try {
      await ensureOlympiaAdminAccess();
      const { supabase } = await getServerAuthContext();
      const olympia = supabase.schema("olympia");
      const parsed = roundControlSchema.safeParse({
        matchId: formData.get("matchId"),
        roundId: formData.get("roundId"),
        roundType: formData.get("roundType"),
      });
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin vòng." };
      }

      const { matchId, roundId, roundType } = parsed.data;

      // Tối ưu: 1 query update, filter trực tiếp theo match_id + status.
      const { data: updatedRows, error } = await olympia
        .from("live_sessions")
        .update({
          current_round_id: roundId,
          current_round_type: roundType,
          current_round_question_id: null,
          question_state: "hidden",
          timer_deadline: null,
          // Khởi động thi chung + CNV: mặc định bật chuông.
          buzzer_enabled: roundType === "khoi_dong" || roundType === "vcnv",
        })
        .eq("match_id", matchId)
        .eq("status", "running")
        .select("id, join_code");

      if (error) return { error: error.message };
      if (!updatedRows || updatedRows.length === 0) {
        return { error: "Phòng chưa ở trạng thái running." };
      }

      // CNV: quyền đoán CNV chỉ áp dụng trong vòng CNV, nên reset cờ mỗi khi đổi vòng.
      const { error: resetDqErr } = await olympia
        .from("match_players")
        .update({ is_disqualified_obstacle: false })
        .eq("match_id", matchId);
      if (resetDqErr) {
        console.warn("[Olympia] reset is_disqualified_obstacle failed:", resetDqErr.message);
      }

      // UI client/guest/mc đã cập nhật qua Supabase Realtime + polling.

      return { success: `Đã chuyển sang vòng ${roundType}.` };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Không thể đổi vòng." };
    }
  });
}

export async function setQuestionStateAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");
    const parsed = questionStateSchema.safeParse({
      matchId: formData.get("matchId"),
      questionState: formData.get("questionState"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin trạng thái." };
    }

    const { matchId, questionState } = parsed.data;
    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận chưa mở phòng live." };

    const { data: sessionFull, error: sessionFullError } = await olympia
      .from("live_sessions")
      .select("id, status, match_id, current_round_type, current_round_question_id")
      .eq("id", session.id)
      .maybeSingle();
    if (sessionFullError) return { error: sessionFullError.message };

    const isVcnv = sessionFull?.current_round_type === "vcnv";

    // Khởi động thi chung: khi bấm Show cần bật chuông + reset để không dính winner cũ.
    const shouldHandleKhoiDongShow =
      questionState === "showing" && sessionFull?.current_round_type === "khoi_dong";

    let isKhoiDongCommon = false;
    if (shouldHandleKhoiDongShow && sessionFull?.current_round_question_id) {
      const { data: rqRow, error: rqErr } = await olympia
        .from("round_questions")
        .select("id, target_player_id, meta")
        .eq("id", sessionFull.current_round_question_id)
        .maybeSingle();
      if (rqErr) return { error: rqErr.message };
      const info = parseKhoiDongCodeInfoFromMeta((rqRow as unknown as { meta?: unknown })?.meta);
      isKhoiDongCommon = info?.kind === "common";

      if (isKhoiDongCommon) {
        const { error: resetTargetErr } = await olympia
          .from("round_questions")
          .update({ target_player_id: null })
          .eq("id", sessionFull.current_round_question_id);
        if (resetTargetErr) {
          console.warn(
            "[Olympia] reset target_player_id (khoi_dong common) failed:",
            resetTargetErr.message
          );
        }

        const { error: resetBuzzErr } = await olympia.from("buzzer_events").insert({
          match_id: (sessionFull as unknown as { match_id?: string | null })?.match_id ?? null,
          round_question_id: sessionFull.current_round_question_id,
          player_id: null,
          event_type: "reset",
          result: null,
        });
        if (resetBuzzErr) {
          console.warn("[Olympia] insert buzzer reset (khoi_dong) failed:", resetBuzzErr.message);
        }
      }
    }

    const buzzerEnabledPatch =
      questionState === "showing" && (isVcnv || isKhoiDongCommon) ? true : null;

    const { error } = await olympia
      .from("live_sessions")
      // Countdown không tự chạy khi bấm Show; host sẽ bấm "Bấm giờ" để bắt đầu.
      .update({
        question_state: questionState,
        timer_deadline: null,
        ...(questionState === "showing"
          ? {
              show_scoreboard_overlay: false,
              show_answers_overlay: false,
            }
          : {}),
        ...(buzzerEnabledPatch != null ? { buzzer_enabled: buzzerEnabledPatch } : {}),
      })
      .eq("id", session.id);

    if (error) return { error: error.message };

    // VCNV: mỗi lần mở câu hỏi, reset trạng thái chuông để không dính winner cũ.
    if (
      questionState === "showing" &&
      isVcnv &&
      sessionFull?.match_id &&
      sessionFull?.current_round_question_id
    ) {
      const { error: resetErr } = await olympia.from("buzzer_events").insert({
        match_id: sessionFull.match_id,
        round_question_id: sessionFull.current_round_question_id,
        player_id: null,
        event_type: "reset",
        result: null,
      });
      if (resetErr) {
        console.warn("[Olympia] insert buzzer reset (VCNV) failed:", resetErr.message);
      }
    }

    // UI client/guest/mc đã cập nhật qua Supabase Realtime + polling.

    return { success: `Đã cập nhật trạng thái câu hỏi: ${questionState}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật trạng thái." };
  }
}

export async function startSessionTimerAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = startTimerSchema.safeParse({
      sessionId: formData.get("sessionId"),
      durationMs: formData.get("durationMs") ? Number(formData.get("durationMs")) : NaN,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin bấm giờ." };
    }

    const { data: session, error: sessionErr } = await olympia
      .from("live_sessions")
      .select("id, status, question_state, current_round_question_id, timer_deadline")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();
    if (sessionErr) return { error: sessionErr.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (session.status !== "running") return { error: "Phòng chưa ở trạng thái running." };
    if (!session.current_round_question_id) return { error: "Chưa có câu hỏi đang hiển thị." };
    if (session.question_state !== "showing" && session.question_state !== "answer_revealed") {
      return { error: "Host chưa mở câu hỏi/cửa cướp để bấm giờ." };
    }

    // Nếu timer đang chạy, không bấm lại.
    if (session.timer_deadline) {
      const remaining = Date.parse(session.timer_deadline) - Date.now();
      if (Number.isFinite(remaining) && remaining > 0) {
        return { error: "Timer đang chạy." };
      }
    }

    const deadline = new Date(Date.now() + parsed.data.durationMs).toISOString();
    const { error: updateErr } = await olympia
      .from("live_sessions")
      .update({ timer_deadline: deadline })
      .eq("id", session.id);
    if (updateErr) return { error: updateErr.message };

    return { success: "Đã bắt đầu đếm giờ." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể bắt đầu đếm giờ." };
  }
}

export async function startSessionTimerAutoAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  return await perfAction("[perf][action] startSessionTimerAutoAction", async () => {
    try {
      await ensureOlympiaAdminAccess();
      const { supabase } = await getServerAuthContext();
      const olympia = supabase.schema("olympia");

      const parsed = startTimerAutoSchema.safeParse({
        sessionId: formData.get("sessionId"),
      });
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin bấm giờ." };
      }

      const { data: session, error: sessionErr } = await olympia
        .from("live_sessions")
        .select(
          "id, status, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline"
        )
        .eq("id", parsed.data.sessionId)
        .maybeSingle();
      if (sessionErr) return { error: sessionErr.message };
      if (!session) return { error: "Không tìm thấy phòng thi." };
      if (session.status !== "running") return { error: "Phòng chưa ở trạng thái running." };
      if (!session.current_round_question_id) return { error: "Chưa có câu hỏi đang hiển thị." };
      if (session.question_state !== "showing" && session.question_state !== "answer_revealed") {
        return { error: "Host chưa mở câu hỏi/cửa cướp để bấm giờ." };
      }

      if (session.timer_deadline) {
        const remaining = Date.parse(session.timer_deadline) - Date.now();
        if (Number.isFinite(remaining) && remaining > 0) {
          return { error: "Timer đang chạy." };
        }
      }

      const roundType =
        (session as unknown as { current_round_type?: string | null }).current_round_type ?? null;
      const currentRoundId =
        (session as unknown as { current_round_id?: string | null }).current_round_id ?? null;
      const currentRqId =
        (session as unknown as { current_round_question_id?: string | null })
          .current_round_question_id ?? null;

      let durationMs = getCountdownMs(roundType ?? "khoi_dong");
      if (roundType === "ve_dich" && currentRqId) {
        const { data: rq, error: rqErr } = await olympia
          .from("round_questions")
          .select("id, meta")
          .eq("id", currentRqId)
          .maybeSingle();
        if (rqErr) return { error: rqErr.message };
        durationMs = computeVeDichDurationMsFromMeta((rq as unknown as { meta?: unknown })?.meta);
      } else if (roundType === "tang_toc" && currentRoundId && currentRqId) {
        const { data: rqs, error: rqsErr } = await olympia
          .from("round_questions")
          .select("id, order_index")
          .eq("match_round_id", currentRoundId)
          .order("order_index", { ascending: true });
        if (rqsErr) return { error: rqsErr.message };
        const list = (rqs as unknown as Array<{ id: string; order_index: number }> | null) ?? [];
        const idx = list.findIndex((r) => r.id === currentRqId);
        durationMs = getCountdownMs(roundType, idx);
      }

      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        // Fallback an toàn để tránh lỗi RangeError: Invalid time value
        durationMs = getCountdownMs(roundType ?? "khoi_dong");
      }

      const deadline = new Date(Date.now() + durationMs).toISOString();
      const { error: updateErr } = await olympia
        .from("live_sessions")
        .update({ timer_deadline: deadline })
        .eq("id", session.id);
      if (updateErr) return { error: updateErr.message };

      return { success: "Đã bắt đầu đếm giờ." };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Không thể bắt đầu đếm giờ." };
    }
  });
}

export async function expireSessionTimerAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  return await perfAction("[perf][action] expireSessionTimerAction", async () => {
    try {
      await ensureOlympiaAdminAccess();
      const { supabase } = await getServerAuthContext();
      const olympia = supabase.schema("olympia");

      const parsed = expireTimerSchema.safeParse({
        sessionId: formData.get("sessionId"),
      });
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin hết giờ." };
      }

      const { data: session, error: sessionErr } = await olympia
        .from("live_sessions")
        .select("id, status, question_state, current_round_question_id, current_round_type")
        .eq("id", parsed.data.sessionId)
        .maybeSingle();
      if (sessionErr) return { error: sessionErr.message };
      if (!session) return { error: "Không tìm thấy phòng thi." };
      if (session.status !== "running") return { error: "Phòng chưa ở trạng thái running." };
      if (!session.current_round_question_id) return { error: "Chưa có câu hỏi đang hiển thị." };
      if (session.question_state !== "showing" && session.question_state !== "answer_revealed") {
        return { error: "Host chưa mở câu hỏi/cửa cướp để hết giờ." };
      }

      const roundType =
        (session as unknown as { current_round_type?: string | null }).current_round_type ?? null;
      const questionState =
        (session as unknown as { question_state?: string | null }).question_state ?? null;

      if (roundType === "ve_dich") {
        if (questionState !== "answer_revealed") {
          const deadline = new Date(Date.now() + 5000).toISOString();
          const { error: openErr } = await olympia
            .from("live_sessions")
            .update({
              question_state: "answer_revealed",
              timer_deadline: deadline,
              buzzer_enabled: true,
            })
            .eq("id", session.id);
          if (openErr) return { error: openErr.message };
          return { success: "Đã mở cửa cướp (5s)." };
        }

        const { error: closeErr } = await olympia
          .from("live_sessions")
          .update({ question_state: "completed", timer_deadline: null, buzzer_enabled: false })
          .eq("id", session.id);
        if (closeErr) return { error: closeErr.message };
        return { success: "Đã đóng cửa cướp." };
      }

      const deadline = new Date(Date.now() - 1000).toISOString();
      const { error: updateErr } = await olympia
        .from("live_sessions")
        .update({ timer_deadline: deadline })
        .eq("id", session.id);
      if (updateErr) return { error: updateErr.message };

      return { success: "Đã đặt timer về hết giờ." };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Không thể đặt hết giờ." };
    }
  });
}

// Wrapper cho <form action={...}> trong Server Component (Next.js chỉ truyền 1 tham số FormData).
export async function startSessionTimerFormAction(formData: FormData): Promise<void> {
  await startSessionTimerAction({}, formData);
}

export async function setWaitingScreenAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = waitingScreenSchema.safeParse({
      matchId: formData.get("matchId"),
      enabled: formData.get("enabled"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin màn chờ." };
    }

    const { matchId, enabled } = parsed.data;
    const nextState = enabled ? "hidden" : "showing";

    // Tối ưu: 1 query update
    const { data: updatedRows, error } = await olympia
      .from("live_sessions")
      .update({ question_state: nextState })
      .eq("match_id", matchId)
      .eq("status", "running")
      .select("id");

    if (error) return { error: error.message };
    if (!updatedRows || updatedRows.length === 0) {
      return { error: "Phòng chưa ở trạng thái running." };
    }

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);

    return { success: enabled ? "Đã bật màn chờ." : "Đã tắt màn chờ." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật màn chờ." };
  }
}

export async function endKhoiDongTurnAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = endKhoiDongTurnSchema.safeParse({
      matchId: formData.get("matchId"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin kết thúc lượt." };
    }

    const { matchId } = parsed.data;

    const { data: session, error: sessionErr } = await olympia
      .from("live_sessions")
      .select("id, status, current_round_type, current_round_question_id, question_state")
      .eq("match_id", matchId)
      .eq("status", "running")
      .maybeSingle();
    if (sessionErr) return { error: sessionErr.message };
    if (!session) return { error: "Phòng chưa ở trạng thái running." };
    if (session.current_round_type !== "khoi_dong") {
      return { error: "Chỉ hỗ trợ kết thúc lượt cho vòng Khởi động." };
    }
    if (!session.current_round_question_id) {
      return { error: "Chưa có câu hỏi để kết thúc lượt." };
    }

    const { error: updateErr } = await olympia
      .from("live_sessions")
      .update({
        current_round_question_id: null,
        question_state: "hidden",
        timer_deadline: null,
        buzzer_enabled: false,
      })
      .eq("id", session.id);
    if (updateErr) return { error: updateErr.message };

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);

    return { success: "Đã kết thúc lượt thí sinh." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể kết thúc lượt." };
  }
}

export async function setBuzzerEnabledAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = buzzerEnabledSchema.safeParse({
      matchId: formData.get("matchId"),
      enabled: formData.get("enabled"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin bấm chuông." };
    }

    const { matchId, enabled } = parsed.data;

    // Tối ưu: 1 query update
    const { data: updatedRows, error } = await olympia
      .from("live_sessions")
      .update({ buzzer_enabled: enabled })
      .eq("match_id", matchId)
      .eq("status", "running")
      .select("id");

    if (error) return { error: error.message };
    if (!updatedRows || updatedRows.length === 0) {
      return { error: "Phòng chưa ở trạng thái running." };
    }
    // UI client/guest/mc đã cập nhật qua Supabase Realtime + polling.

    return { success: enabled ? "Đã bật bấm chuông." : "Đã tắt bấm chuông." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật bấm chuông." };
  }
}

export async function setScoreboardOverlayAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = scoreboardOverlaySchema.safeParse({
      matchId: formData.get("matchId"),
      enabled: formData.get("enabled"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin bảng điểm." };
    }

    const { matchId, enabled } = parsed.data;

    const { data: updatedRows, error } = await olympia
      .from("live_sessions")
      .update({ show_scoreboard_overlay: enabled })
      .eq("match_id", matchId)
      .select("id");

    if (error) return { error: error.message };
    if (!updatedRows || updatedRows.length === 0) {
      return { error: "Không tìm thấy phòng để cập nhật bảng điểm." };
    }

    // UI client/guest/mc đã cập nhật qua Supabase Realtime + polling.

    return { success: enabled ? "Đã bật bảng điểm lớn." : "Đã tắt bảng điểm lớn." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật bảng điểm." };
  }
}

// Wrapper dùng trực tiếp cho <form action={...}> trong Server Component.
// Next.js form action chỉ truyền 1 tham số (FormData).
export async function setScoreboardOverlayFormAction(formData: FormData): Promise<void> {
  await setScoreboardOverlayAction({}, formData);
}

export async function setAnswersOverlayAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = answersOverlaySchema.safeParse({
      matchId: formData.get("matchId"),
      enabled: formData.get("enabled"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin đáp án." };
    }

    const { matchId, enabled } = parsed.data;

    const { data: updatedRows, error } = await olympia
      .from("live_sessions")
      .update({ show_answers_overlay: enabled })
      .eq("match_id", matchId)
      .select("id");

    if (error) return { error: error.message };
    if (!updatedRows || updatedRows.length === 0) {
      return { error: "Không tìm thấy phòng để cập nhật đáp án." };
    }

    // UI client/guest/mc đã cập nhật qua Supabase Realtime + polling.

    return { success: enabled ? "Đã bật tab đáp án." : "Đã tắt tab đáp án." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật đáp án." };
  }
}

// Wrapper dùng trực tiếp cho <form action={...}> trong Server Component.
export async function setAnswersOverlayFormAction(formData: FormData): Promise<void> {
  await setAnswersOverlayAction({}, formData);
}

export async function submitAnswerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const startedAt = Date.now();
    const traceId = getOrCreateTraceId(formData);
    traceInfo({
      traceId,
      action: "submitAnswerAction",
      event: "start",
      fields: {
        sessionId: readStringFormField(formData, "sessionId"),
        payloadBytes: estimateFormDataPayloadBytes(formData),
      },
    });

    const { supabase, authUid, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");
    if (!authUid || !appUserId) {
      return { error: "Bạn cần đăng nhập để gửi đáp án." };
    }

    const parsed = submitAnswerSchema.safeParse({
      sessionId: formData.get("sessionId"),
      answer: formData.get("answer"),
      notes: formData.get("notes"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
    }

    const sessionId = parsed.data.sessionId;
    const { data: session, error } = await olympia
      .from("live_sessions")
      .select(
        "id, status, match_id, current_round_question_id, current_round_type, question_state, timer_deadline"
      )
      .eq("id", sessionId)
      .maybeSingle();

    traceInfo({
      traceId,
      action: "submitAnswerAction",
      event: "db.live_sessions",
      fields: { msSinceStart: Date.now() - startedAt },
    });

    if (error) return { error: error.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (session.status !== "running") {
      return { error: "Phòng chưa mở nhận đáp án." };
    }
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };
    if (!session.current_round_question_id) return { error: "Chưa có câu hỏi đang mở." };

    const isVeDichStealWindow =
      session.current_round_type === "ve_dich" && session.question_state === "answer_revealed";
    const canAnswerNow = session.question_state === "showing" || isVeDichStealWindow;
    if (!canAnswerNow) {
      return { error: "Host chưa mở câu hỏi/cửa cướp để nhận đáp án." };
    }

    const deadlineIso =
      (session as unknown as { timer_deadline?: string | null }).timer_deadline ?? null;
    if (deadlineIso) {
      const remaining = Date.parse(deadlineIso) - Date.now();
      if (Number.isFinite(remaining) && remaining <= 0) {
        return { error: "Hết giờ." };
      }
    }

    const [{ data: playerRow, error: playerError }, { data: roundQuestion, error: rqError }] =
      await Promise.all([
        olympia
          .from("match_players")
          .select("id, is_disqualified_obstacle")
          .eq("match_id", session.match_id)
          .eq("participant_id", appUserId)
          .maybeSingle(),
        olympia
          .from("round_questions")
          .select("id, match_round_id, target_player_id, meta, answer_text")
          .eq("id", session.current_round_question_id)
          .maybeSingle(),
      ]);

    traceInfo({
      traceId,
      action: "submitAnswerAction",
      event: "db.match_players",
      fields: { msSinceStart: Date.now() - startedAt },
    });
    traceInfo({
      traceId,
      action: "submitAnswerAction",
      event: "db.round_questions",
      fields: { msSinceStart: Date.now() - startedAt },
    });

    if (playerError) return { error: playerError.message };
    if (!playerRow) return { error: "Bạn không thuộc trận này." };

    if (rqError) return { error: rqError.message };
    if (!roundQuestion) return { error: "Không tìm thấy câu hỏi hiện tại." };

    // CNV: nếu đã bị loại quyền đoán CNV trong vòng này, không cho gửi đáp án từ khung nhập.
    if (session.current_round_type === "vcnv" && playerRow.is_disqualified_obstacle === true) {
      return { error: "Bạn đã bị loại quyền trả lời ở vòng CNV này." };
    }

    // Khởi động lượt cá nhân: chỉ thí sinh đúng ghế (KD{seat}-) mới được gửi đáp án.
    // Ưu tiên target_player_id nếu có; nếu không có, suy luận theo meta.code.
    // Ngoại lệ: Về đích mở cửa cướp (question_state='answer_revealed') → chỉ steal-winner mới được trả lời.
    const inferredKhoiDong =
      session.current_round_type === "khoi_dong" && !roundQuestion.target_player_id
        ? parseKhoiDongCodeInfoFromMeta((roundQuestion as unknown as { meta?: unknown }).meta)
        : null;
    if (session.current_round_type === "khoi_dong" && inferredKhoiDong?.kind === "personal") {
      const { data: seatPlayer, error: seatErr } = await olympia
        .from("match_players")
        .select("id")
        .eq("match_id", session.match_id)
        .eq("seat_index", inferredKhoiDong.seat)
        .maybeSingle();
      if (seatErr) return { error: seatErr.message };
      if (!seatPlayer?.id)
        return { error: `Không tìm thấy thí sinh ghế ${inferredKhoiDong.seat}.` };
      if (seatPlayer.id !== playerRow.id) {
        return { error: "Đây là lượt cá nhân, bạn không phải người được chọn." };
      }
    }

    // VCNV: tất cả thí sinh đều được nhập đáp án trên máy.
    // target_player_id (nếu có) chỉ dùng để biểu thị lượt chọn hàng, không khóa quyền nhập đáp án.
    if (
      session.current_round_type !== "vcnv" &&
      roundQuestion.target_player_id &&
      roundQuestion.target_player_id !== playerRow.id
    ) {
      if (
        session.current_round_type === "ve_dich" &&
        session.question_state === "answer_revealed"
      ) {
        const { data: stealWinner, error: stealError } = await olympia
          .from("buzzer_events")
          .select("player_id, result")
          .eq("round_question_id", roundQuestion.id)
          .eq("event_type", "steal")
          .eq("result", "win")
          .order("occurred_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (stealError) return { error: stealError.message };
        if (!stealWinner?.player_id) return { error: "Chưa có người giành quyền cướp." };
        if (stealWinner.player_id !== playerRow.id) {
          return { error: "Bạn không có quyền trả lời cướp câu này." };
        }

        // Về đích: trả lời cướp chỉ ghi nhận đáp án đầu tiên.
        const { count: existingCount, error: existingErr } = await olympia
          .from("answers")
          .select("id", { count: "exact", head: true })
          .eq("match_id", session.match_id)
          .eq("player_id", playerRow.id)
          .eq("round_question_id", roundQuestion.id);
        if (existingErr) return { error: existingErr.message };
        if ((existingCount ?? 0) > 0) {
          return { error: "Về đích: chỉ ghi nhận đáp án cướp đầu tiên." };
        }
      } else {
        return { error: "Đây là lượt cá nhân, bạn không phải người được chọn." };
      }
    }

    const submittedAt = new Date().toISOString();
    const autoMarkCorrect =
      session.current_round_type === "tang_toc"
        ? isAnswerCorrectLoose({
            submitted: parsed.data.answer,
            expected:
              (roundQuestion as unknown as { answer_text?: string | null }).answer_text ?? null,
          })
        : null;
    // Tính response_time_ms dựa trên mốc reset gần nhất (khi host show câu)
    let responseTimeMs: number | null = null;
    try {
      const { data: lastReset } = await olympia
        .from("buzzer_events")
        .select("occurred_at")
        .eq("round_question_id", roundQuestion.id)
        .eq("event_type", "reset")
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      traceInfo({
        traceId,
        action: "submitAnswerAction",
        event: "db.buzzer_events.last_reset",
        fields: { msSinceStart: Date.now() - startedAt },
      });
      const submittedMs = Date.parse(submittedAt);
      const resetMs = lastReset?.occurred_at
        ? Date.parse(lastReset.occurred_at as unknown as string)
        : NaN;
      if (Number.isFinite(submittedMs) && Number.isFinite(resetMs)) {
        responseTimeMs = Math.max(0, submittedMs - resetMs);
      }
    } catch {
      responseTimeMs = null;
    }

    const { error: insertError } = await olympia.from("answers").insert({
      match_id: session.match_id,
      match_round_id: roundQuestion.match_round_id,
      round_question_id: roundQuestion.id,
      player_id: playerRow.id,
      answer_text: parsed.data.answer,
      response_time_ms: responseTimeMs,
      submitted_at: submittedAt,
      is_correct: autoMarkCorrect,
    });

    traceInfo({
      traceId,
      action: "submitAnswerAction",
      event: "db.answers.insert",
      fields: { msSinceStart: Date.now() - startedAt },
    });

    if (insertError) {
      return { error: insertError.message };
    }

    traceInfo({
      traceId,
      action: "submitAnswerAction",
      event: "end",
      fields: { msTotal: Date.now() - startedAt, matchId: session.match_id },
    });
    return { success: "Đã ghi nhận đáp án. Host sẽ chấm và cập nhật điểm." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể gửi đáp án ngay lúc này." };
  }
}

export async function triggerBuzzerAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const startedAt = Date.now();
    const traceId = getOrCreateTraceId(formData);
    traceInfo({
      traceId,
      action: "triggerBuzzerAction",
      event: "start",
      fields: {
        sessionId: readStringFormField(formData, "sessionId"),
        payloadBytes: estimateFormDataPayloadBytes(formData),
      },
    });

    const { supabase, authUid, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");
    if (!authUid || !appUserId) {
      return { error: "Bạn cần đăng nhập để bấm chuông." };
    }

    const parsed = buzzerSchema.safeParse({ sessionId: formData.get("sessionId") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Mã phòng không hợp lệ." };
    }

    const { data: session, error } = await olympia
      .from("live_sessions")
      .select(
        "id, status, match_id, current_round_question_id, question_state, current_round_type, buzzer_enabled"
      )
      .eq("id", parsed.data.sessionId)
      .maybeSingle();

    traceInfo({
      traceId,
      action: "triggerBuzzerAction",
      event: "db.live_sessions",
      fields: { msSinceStart: Date.now() - startedAt },
    });

    if (error) return { error: error.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (session.status !== "running") {
      return { error: "Phòng chưa sẵn sàng nhận tín hiệu buzzer." };
    }
    if (session.buzzer_enabled === false) {
      return { error: "Host đang tắt bấm chuông." };
    }
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };
    // Hỗ trợ 'trial' (thử chuông): client gửi thêm field 'trial'=1 để thử chuông trên màn chờ.
    const rawTrial = formData.get("trial");
    const isTrial =
      String(rawTrial ?? "") === "1" || String(rawTrial ?? "").toLowerCase() === "true";

    const isVeDichStealWindow =
      session.current_round_type === "ve_dich" && session.question_state === "answer_revealed";

    if (!session.current_round_question_id && !isTrial)
      return { error: "Chưa có câu hỏi đang hiển thị." };

    if (!isTrial) {
      const canBuzzNow = session.question_state === "showing" || isVeDichStealWindow;
      if (!canBuzzNow) {
        return { error: "Host chưa mở câu hỏi/cửa cướp để nhận buzzer." };
      }
    }

    const { data: playerRow, error: playerError } = await olympia
      .from("match_players")
      .select("id, is_disqualified_obstacle")
      .eq("match_id", session.match_id)
      .eq("participant_id", appUserId)
      .maybeSingle();

    traceInfo({
      traceId,
      action: "triggerBuzzerAction",
      event: "db.match_players",
      fields: { msSinceStart: Date.now() - startedAt },
    });

    if (playerError) return { error: playerError.message };
    if (!playerRow) return { error: "Bạn không thuộc trận này." };

    // Nếu là thử chuông (trial): phát realtime event để guest nghe chuông nhưng không lưu DB.
    if (isTrial) {
      const now = new Date().toISOString();
      const trialId = randomUUID();
      const trialPayload: {
        id: string;
        roundQuestionId: string | null;
        playerId: string;
        eventType: string;
        result: string;
        occurredAt: string;
      } = {
        id: trialId,
        roundQuestionId: null,
        playerId: playerRow.id,
        eventType: "trial",
        result: "trial",
        occurredAt: now,
      };

      const { error: emitErr } = await olympia.from("realtime_events").insert({
        match_id: session.match_id,
        session_id: session.id,
        entity: "buzzer_events",
        entity_id: trialId,
        event_type: "INSERT",
        payload: trialPayload,
      });

      traceInfo({
        traceId,
        action: "triggerBuzzerAction",
        event: "db.realtime_events.insert_trial",
        fields: { msSinceStart: Date.now() - startedAt },
      });

      if (emitErr) return { error: emitErr.message };
      return { success: "Gửi tín hiệu thử chuông." };
    }

    const { data: rq, error: rqError } = await olympia
      .from("round_questions")
      .select("id, target_player_id, meta")
      .eq("id", session.current_round_question_id)
      .maybeSingle();

    traceInfo({
      traceId,
      action: "triggerBuzzerAction",
      event: "db.round_questions",
      fields: { msSinceStart: Date.now() - startedAt },
    });

    if (rqError) return { error: rqError.message };
    if (!rq) return { error: "Không tìm thấy câu hỏi hiện tại." };

    if (session.current_round_type === "vcnv" && playerRow.is_disqualified_obstacle === true) {
      return { error: "Bạn đã bị loại quyền đoán CNV ở vòng này." };
    }

    // Khởi động lượt cá nhân: không cho bấm chuông.
    const inferredKhoiDong =
      session.current_round_type === "khoi_dong" && !rq?.target_player_id
        ? parseKhoiDongCodeInfoFromMeta((rq as unknown as { meta?: unknown })?.meta)
        : null;

    if (rq?.target_player_id || inferredKhoiDong?.kind === "personal") {
      if (session.current_round_type === "ve_dich" && isVeDichStealWindow) {
        if (rq && rq.target_player_id && rq.target_player_id === playerRow.id) {
          return { error: "Bạn là người đang trả lời chính, không thể bấm cướp." };
        }
      } else {
        return { error: "Câu này là lượt cá nhân, không dùng buzzer." };
      }
    }

    const eventType = isVeDichStealWindow ? "steal" : "buzz";

    // Client lọc buzzer theo reset gần nhất, nên server cũng phải áp dụng cùng logic.
    // Nếu không, có thể xảy ra lệch trạng thái: UI báo "Chưa ai bấm" nhưng server lại nghĩ đã có winner cũ.
    const { data: lastReset, error: resetErr } = await olympia
      .from("buzzer_events")
      .select("occurred_at")
      .eq("round_question_id", session.current_round_question_id)
      .eq("event_type", "reset")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    traceInfo({
      traceId,
      action: "triggerBuzzerAction",
      event: "db.buzzer_events.last_reset",
      fields: { msSinceStart: Date.now() - startedAt },
    });
    if (resetErr) return { error: resetErr.message };
    const resetOccurredAt =
      (lastReset as unknown as { occurred_at?: string | null })?.occurred_at ?? null;

    // Nếu đã có người thắng, không cho nhận thêm.
    let firstBuzzQuery = olympia
      .from("buzzer_events")
      .select("id, player_id, result, occurred_at")
      .eq("round_question_id", session.current_round_question_id)
      .eq("event_type", eventType);
    if (resetOccurredAt) {
      firstBuzzQuery = firstBuzzQuery.gte("occurred_at", resetOccurredAt);
    }
    const { data: firstBuzz, error: buzzError } = await firstBuzzQuery
      .order("occurred_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    traceInfo({
      traceId,
      action: "triggerBuzzerAction",
      event: "db.buzzer_events.first_buzz",
      fields: { msSinceStart: Date.now() - startedAt },
    });

    if (buzzError) return { error: buzzError.message };
    if (firstBuzz && firstBuzz.result === "win" && firstBuzz.player_id !== playerRow.id) {
      return { error: "Đã có người bấm trước." };
    }

    if (firstBuzz && firstBuzz.player_id === playerRow.id && firstBuzz.result === "win") {
      return { success: "Bạn đã là người bấm nhanh nhất." };
    }

    const isWinner = !firstBuzz;
    const now = new Date().toISOString();
    const { error: insertError } = await olympia.from("buzzer_events").insert({
      match_id: session.match_id,
      round_question_id: session.current_round_question_id,
      player_id: playerRow.id,
      event_type: eventType,
      result: isWinner ? "win" : "lose",
      occurred_at: now,
    });

    traceInfo({
      traceId,
      action: "triggerBuzzerAction",
      event: "db.buzzer_events.insert",
      fields: { msSinceStart: Date.now() - startedAt, isWinner },
    });

    if (insertError) return { error: insertError.message };

    // Khi có người bấm chuông thắng (không phải cửa cướp Về đích), coi như "lượt cá nhân".
    // Mục tiêu: khóa quyền gửi đáp án cho các thí sinh khác và bật chấm điểm nhanh cho đúng người.
    if (isWinner && eventType === "buzz" && session.current_round_type !== "vcnv") {
      const { error: lockErr } = await olympia
        .from("round_questions")
        .update({ target_player_id: playerRow.id })
        .eq("id", session.current_round_question_id);
      if (lockErr) {
        console.warn("[Olympia][Buzzer] Failed to set target_player_id", lockErr.message);
      }
    }

    // Về đích: nếu đang ở cửa cướp và bạn là người thắng, cho 3 giây trả lời và đóng chuông.
    if (isWinner && eventType === "steal") {
      const deadline = new Date(Date.now() + 3000).toISOString();
      await olympia
        .from("live_sessions")
        .update({ timer_deadline: deadline, buzzer_enabled: false })
        .eq("id", session.id);
    }

    traceInfo({
      traceId,
      action: "triggerBuzzerAction",
      event: "end",
      fields: { msTotal: Date.now() - startedAt, matchId: session.match_id, isWinner },
    });
    return {
      success: isWinner
        ? eventType === "steal"
          ? "Bạn đã giành quyền cướp (3 giây trả lời)."
          : session.current_round_type === "vcnv"
            ? "Bạn đã bấm chuông xin đoán CNV (trả lời miệng)."
            : "Bạn đã giành quyền trả lời."
        : "Đã ghi nhận tín hiệu (không phải người nhanh nhất).",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể gửi tín hiệu buzzer." };
  }
}

export async function selectVeDichPackageAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const rawValues = formData.getAll("values");
    const isEditingFromForm = formData.get("isEditing") === "1";

    const parsed = veDichPackageSchema.safeParse({
      matchId: formData.get("matchId"),
      playerId: formData.get("playerId"),
      values: rawValues.map((v) => (typeof v === "string" ? Number(v) : NaN)),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin chọn gói Về đích." };
    }

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status, match_id, join_code, current_round_type, current_round_id")
      .eq("match_id", parsed.data.matchId)
      .eq("status", "running")
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận chưa mở phòng live (running)." };
    if (session.current_round_type !== "ve_dich") return { error: "Hiện không ở vòng Về đích." };
    if (!session.current_round_id) return { error: "Chưa có round Về đích hiện tại." };

    const { data: player, error: playerErr } = await olympia
      .from("match_players")
      .select("id, seat_index")
      .eq("id", parsed.data.playerId)
      .eq("match_id", parsed.data.matchId)
      .maybeSingle();
    if (playerErr) return { error: playerErr.message };
    if (!player) return { error: "Thí sinh không thuộc trận này." };
    if (!player.seat_index) return { error: "Thiếu seat_index của thí sinh." };

    const { data: rqRows, error: rqErr } = await olympia
      .from("round_questions")
      .select("id, meta, target_player_id, order_index, question_set_item_id")
      .eq("match_round_id", session.current_round_id)
      .order("order_index", { ascending: true });
    if (rqErr) return { error: rqErr.message };

    const seat = player.seat_index;
    const range = getVeDichSlotRangeForSeat(seat);
    const mine = (rqRows ?? []).filter((rq) => {
      const orderIndex = (rq as unknown as { order_index?: unknown }).order_index;
      return getVeDichSeatFromOrderIndex(orderIndex) === seat;
    });
    if (mine.length < 3) {
      return {
        error: `Không tìm thấy đủ 3 slot Về đích cho ghế ${seat} (order_index ${range.start}..${range.end}).`,
      };
    }

    const slots = mine
      .slice()
      .sort((a, b) => ((a.order_index ?? 0) as number) - ((b.order_index ?? 0) as number))
      .slice(0, 3);

    // Kiểm tra xem có đang chỉnh sửa không (từ form hoặc từ DB)
    const isEditingFromDB = slots.some((rq) => {
      const qsi = (rq as unknown as { question_set_item_id?: string | null }).question_set_item_id;
      return Boolean(qsi);
    });
    const isEditing = isEditingFromForm || isEditingFromDB;

    // Nếu đang chỉnh sửa, lấy giá trị cũ để so sánh
    const oldValues: Array<20 | 30 | null> = slots.map((rq) => {
      const meta = (rq as unknown as { meta?: unknown }).meta;
      const metaObj = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
      const raw = metaObj.ve_dich_value;
      const v = typeof raw === "number" ? raw : raw ? Number(raw) : Number.NaN;
      return v === 20 || v === 30 ? v : null;
    });

    // Kiểm tra xem có thay đổi giá trị không
    const packageValues = parsed.data.values as VeDichPackageValue[];
    const valuesChanged = isEditing && packageValues.some((v, idx) => v !== oldValues[idx]);

    // Nếu đang chỉnh sửa và có thay đổi giá trị, cần reset câu hỏi cũ
    // Lưu lại question_set_item_id cũ để loại bỏ khỏi pool
    const oldQuestionSetItemIds = new Set<string>();
    if (valuesChanged) {
      for (const rq of slots) {
        const qsi = (rq as unknown as { question_set_item_id?: string | null })
          .question_set_item_id;
        if (qsi) oldQuestionSetItemIds.add(qsi);
      }
    }

    const { data: matchSets, error: matchSetsErr } = await olympia
      .from("match_question_sets")
      .select("question_set_id")
      .eq("match_id", parsed.data.matchId);
    if (matchSetsErr) return { error: matchSetsErr.message };
    const questionSetIds = (matchSets ?? [])
      .map((r) => (r as unknown as { question_set_id?: string | null }).question_set_id ?? null)
      .filter((id): id is string => Boolean(id));
    if (questionSetIds.length === 0) {
      return { error: "Trận chưa gắn bộ đề (match_question_sets)." };
    }

    type PoolItem = {
      id: string;
      code: string | null;
      question_text: string;
      answer_text: string;
      note: string | null;
    };

    const [{ data: pool20, error: pool20Err }, { data: pool30, error: pool30Err }] =
      await Promise.all([
        olympia
          .from("question_set_items")
          .select("id, code, question_text, answer_text, note")
          .in("question_set_id", questionSetIds)
          .or("code.ilike.VD-20.%,code.ilike.VD20.%"),
        olympia
          .from("question_set_items")
          .select("id, code, question_text, answer_text, note")
          .in("question_set_id", questionSetIds)
          .or("code.ilike.VD-30.%,code.ilike.VD30.%"),
      ]);

    if (pool20Err) return { error: pool20Err.message };
    if (pool30Err) return { error: pool30Err.message };

    const normalizedPool20 = (pool20 as unknown as PoolItem[] | null) ?? [];
    const normalizedPool30 = (pool30 as unknown as PoolItem[] | null) ?? [];

    if (normalizedPool20.length === 0 || normalizedPool30.length === 0) {
      return {
        error:
          "Không tìm thấy pool câu Về đích (cần question_set_items.code bắt đầu bằng VD-20. và VD-30.).",
      };
    }

    const { data: usedRows, error: usedErr } = await olympia
      .from("round_questions")
      .select("question_set_item_id")
      .eq("match_round_id", session.current_round_id)
      .not("question_set_item_id", "is", null);
    if (usedErr) return { error: usedErr.message };

    const used = new Set<string>();
    const usedIds: string[] = [];
    for (const r of usedRows ?? []) {
      const id =
        (r as unknown as { question_set_item_id?: string | null }).question_set_item_id ?? null;
      if (id) {
        // Nếu đang chỉnh sửa và đổi giá trị, loại bỏ câu hỏi cũ của thí sinh này khỏi used
        if (!valuesChanged || !oldQuestionSetItemIds.has(id)) {
          used.add(id);
          usedIds.push(id);
        }
      }
    }

    const normalizeVeDichKey = (item: { question_text: string; answer_text: string }): string => {
      const q = item.question_text.trim().toLowerCase();
      const a = item.answer_text.trim().toLowerCase();
      return `${q}||${a}`;
    };

    const usedKeys = new Set<string>();
    if (usedIds.length) {
      const { data: usedItems, error: usedItemsErr } = await olympia
        .from("question_set_items")
        .select("id, question_text, answer_text")
        .in("id", usedIds);
      if (usedItemsErr) return { error: usedItemsErr.message };
      for (const row of (usedItems as unknown as Array<{
        question_text?: string;
        answer_text?: string;
      }> | null) ?? []) {
        const qt = typeof row.question_text === "string" ? row.question_text : "";
        const at = typeof row.answer_text === "string" ? row.answer_text : "";
        if (qt || at) usedKeys.add(normalizeVeDichKey({ question_text: qt, answer_text: at }));
      }
    }

    const pickOne = (candidates: PoolItem[]): PoolItem | null => {
      const eligible = candidates.filter(
        (it) => !used.has(it.id) && !usedKeys.has(normalizeVeDichKey(it))
      );
      if (eligible.length === 0) return null;
      const chosen = eligible[Math.floor(Math.random() * eligible.length)] ?? null;
      if (!chosen) return null;
      used.add(chosen.id);
      usedKeys.add(normalizeVeDichKey(chosen));
      return chosen;
    };

    const chosenItems: PoolItem[] = [];
    for (const v of packageValues) {
      const item = pickOne(v === 20 ? normalizedPool20 : normalizedPool30);
      if (!item) {
        return {
          error:
            v === 20
              ? "Pool VD-20 hết câu hoặc tất cả đã được chọn."
              : "Pool VD-30 hết câu hoặc tất cả đã được chọn.",
        };
      }
      chosenItems.push(item);
    }

    const updates = slots.map((rq, idx) => {
      const meta = (rq as unknown as { meta?: unknown }).meta;
      const metaObj = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
      const item = chosenItems[idx];
      const nextMeta = { ...metaObj, ve_dich_value: packageValues[idx], code: item.code };
      return olympia
        .from("round_questions")
        .update({
          target_player_id: player.id,
          meta: nextMeta,
          question_set_item_id: item.id,
          question_text: item.question_text,
          answer_text: item.answer_text,
          note: item.note,
        })
        .eq("id", (rq as unknown as { id: string }).id);
    });

    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) return { error: firstError.message };

    // Nếu đang chỉnh sửa và đổi giá trị, xóa answers cũ của các câu hỏi này
    if (valuesChanged) {
      const slotIds = slots.map((rq) => (rq as unknown as { id: string }).id);
      const { error: deleteAnswersErr } = await olympia
        .from("answers")
        .delete()
        .in("round_question_id", slotIds)
        .eq("player_id", player.id);
      if (deleteAnswersErr) {
        console.warn(
          "[selectVeDichPackageAction] Không thể xóa answers cũ:",
          deleteAnswersErr.message
        );
      }
    }

    revalidatePath("/olympia/client");
    if (session.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
      revalidatePath(`/olympia/client/guest/${session.join_code}`);
    }
    const summary = packageValues.join("-");
    const action = isEditing ? (valuesChanged ? "đã chỉnh sửa" : "đã xác nhận lại") : "đã chốt";
    return { success: `${action} gói Về đích ${summary} cho Ghế ${seat} (3 câu).` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể chọn gói Về đích." };
  }
}

export async function selectVeDichPackageFormAction(formData: FormData): Promise<void> {
  await selectVeDichPackageAction({}, formData);
}

export async function selectVeDichPackageClientAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  return await selectVeDichPackageAction({}, formData);
}

export async function resetAllVeDichPackagesAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const matchIdRaw = formData.get("matchId");
    if (!matchIdRaw || typeof matchIdRaw !== "string") {
      return { error: "Thiếu matchId." };
    }

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status, match_id, current_round_type, current_round_id")
      .eq("match_id", matchIdRaw)
      .eq("status", "running")
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận chưa mở phòng live (running)." };
    if (session.current_round_type !== "ve_dich") return { error: "Hiện không ở vòng Về đích." };
    if (!session.current_round_id) return { error: "Chưa có round Về đích hiện tại." };

    // Reset tất cả round_questions của vòng về đích: xóa question_set_item_id, target_player_id
    // và reset ve_dich_value trong meta
    const { data: allRqs, error: rqsErr } = await olympia
      .from("round_questions")
      .select("id, meta")
      .eq("match_round_id", session.current_round_id);
    if (rqsErr) return { error: rqsErr.message };

    const updates = (allRqs ?? []).map((rq) => {
      const meta = (rq as unknown as { meta?: unknown }).meta;
      const metaObj = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
      const nextMeta = { ...metaObj };
      delete nextMeta.ve_dich_value;
      delete nextMeta.code;

      return olympia
        .from("round_questions")
        .update({
          target_player_id: null,
          meta: nextMeta,
          question_set_item_id: null,
          question_text: null,
          answer_text: null,
          note: null,
        })
        .eq("id", (rq as unknown as { id: string }).id);
    });

    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) return { error: firstError.message };

    return { success: "Đã reset gói Về đích cho tất cả thí sinh." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể reset gói Về đích." };
  }
}

export async function resetAllVeDichPackagesFormAction(formData: FormData): Promise<void> {
  await resetAllVeDichPackagesAction({}, formData);
}

export async function setGuestMediaControlAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = guestMediaControlSchema.safeParse({
      matchId: formData.get("matchId"),
      mediaType: formData.get("mediaType"),
      command: formData.get("command"),
      mediaSrc: formData.get("mediaSrc"),
      mediaSrcs: formData.get("mediaSrcs"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin điều khiển media." };
    }

    const { matchId, mediaType, command } = parsed.data;
    const rawMediaSrc = formData.get("mediaSrc") as string | null;
    const rawMediaSrcs = formData.get("mediaSrcs") as string | null;

    const { data: sessionRow, error: sessionErr } = await olympia
      .from("live_sessions")
      .select("id, status, guest_media_control")
      .eq("match_id", matchId)
      .maybeSingle();

    if (sessionErr) {
      const msg = sessionErr.message ?? "Không thể tải phòng live.";
      const lower = msg.toLowerCase();
      if (lower.includes("guest_media_control")) {
        return {
          error:
            "API schema cache chưa nhận cột guest_media_control (hoặc DB chưa có cột). Vui lòng reload schema cache của Supabase/PostgREST rồi thử lại. Chi tiết: " +
            msg,
        };
      }
      if (lower.includes("updated_at")) {
        return {
          error:
            "Bảng live_sessions không có cột updated_at (theo schema hiện tại), nên không thể update. Chi tiết: " +
            msg,
        };
      }
      return { error: msg };
    }
    if (!sessionRow?.id) return { error: "Trận chưa mở phòng live." };
    if (sessionRow.status !== "running") return { error: "Phòng chưa ở trạng thái running." };

    const rawControl = (sessionRow as unknown as { guest_media_control?: unknown })
      .guest_media_control;
    const prevControl: GuestMediaControl =
      rawControl && typeof rawControl === "object" ? (rawControl as GuestMediaControl) : {};

    const prevCmd = prevControl[mediaType];
    const prevId = typeof prevCmd?.commandId === "number" ? prevCmd.commandId : 0;
    const nextCmd: GuestMediaCommand = {
      commandId: prevId + 1,
      action: command,
      issuedAt: new Date().toISOString(),
    };

    // Attach optional srcs if provided (single or JSON array)
    try {
      let srcs: string[] | undefined = undefined;
      if (rawMediaSrcs) {
        const parsedArr = JSON.parse(rawMediaSrcs);
        if (Array.isArray(parsedArr)) {
          srcs = parsedArr.map((s) => String(s)).filter(Boolean);
        }
      }
      if (!srcs && rawMediaSrc) {
        srcs = [rawMediaSrc];
      }
      if (srcs && srcs.length > 0) nextCmd.srcs = srcs;
    } catch {
      // ignore malformed mediaSrcs
    }

    const nextControl: GuestMediaControl = {
      ...prevControl,
      version: 1,
      [mediaType]: nextCmd,
    };

    const { error: updateErr } = await olympia
      .from("live_sessions")
      .update({ guest_media_control: nextControl })
      .eq("id", sessionRow.id);

    if (updateErr) {
      const msg = updateErr.message ?? "Không thể cập nhật điều khiển media.";
      const lower = msg.toLowerCase();
      if (lower.includes("guest_media_control")) {
        return {
          error:
            "API schema cache chưa nhận cột guest_media_control (hoặc DB chưa có cột). Vui lòng reload schema cache của Supabase/PostgREST rồi thử lại. Chi tiết: " +
            msg,
        };
      }
      if (lower.includes("updated_at")) {
        return {
          error:
            "Bảng live_sessions không có cột updated_at (theo schema hiện tại), nên không thể update. Chi tiết: " +
            msg,
        };
      }
      return { error: msg };
    }

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);

    return { success: `Đã gửi lệnh ${command} (${mediaType}) cho guest.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể điều khiển media guest." };
  }
}

export async function setGuestMediaControlFormAction(formData: FormData): Promise<void> {
  await setGuestMediaControlAction({}, formData);
}

// Xóa command khỏi guest_media_control khi guest đã xử lý
export async function clearGuestMediaCommandAction(
  matchId: string,
  mediaType: "audio" | "video",
  commandId: number
): Promise<void> {
  try {
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const { data: sessionRow, error: fetchErr } = await olympia
      .from("live_sessions")
      .select("id, guest_media_control")
      .eq("match_id", matchId)
      .maybeSingle();

    if (fetchErr || !sessionRow?.id) {
      console.error("[clearGuestMediaCommandAction] fetch error", fetchErr);
      return;
    }

    const rawControl = (sessionRow as unknown as { guest_media_control?: unknown })
      .guest_media_control;
    const prevControl: GuestMediaControl =
      rawControl && typeof rawControl === "object" ? (rawControl as GuestMediaControl) : {};

    const currentCmd = prevControl[mediaType];
    if (!currentCmd || currentCmd.commandId !== commandId) {
      // Command khác hoặc đã bị xóa
      return;
    }

    // Keep a tombstone with the last seen commandId so IDs remain monotonic.
    const nextControl = { ...prevControl, [mediaType]: { commandId: currentCmd.commandId } };

    const { error: updateErr } = await olympia
      .from("live_sessions")
      .update({ guest_media_control: nextControl })
      .eq("id", sessionRow.id);

    if (updateErr) {
      console.error("[clearGuestMediaCommandAction] update error", updateErr);
    }
  } catch (err) {
    console.error("[clearGuestMediaCommandAction] error", err);
  }
}

export async function setCurrentQuestionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const startedAt = Date.now();
    const traceId = getOrCreateTraceId(formData);
    traceInfo({
      traceId,
      action: "setCurrentQuestionAction",
      event: "start",
      fields: {
        matchId: readStringFormField(formData, "matchId"),
        roundQuestionId: readStringFormField(formData, "roundQuestionId"),
        payloadBytes: estimateFormDataPayloadBytes(formData),
      },
    });
    const { supabase } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = setCurrentQuestionSchema.safeParse({
      matchId: formData.get("matchId"),
      roundQuestionId: formData.get("roundQuestionId"),
      durationMs: formData.get("durationMs") ? Number(formData.get("durationMs")) : undefined,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin câu hỏi." };
    }

    const { matchId, roundQuestionId } = parsed.data;
    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();

    traceInfo({
      traceId,
      action: "setCurrentQuestionAction",
      event: "db.live_sessions",
      fields: { msSinceStart: Date.now() - startedAt },
    });
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận chưa mở phòng live." };
    if (session.status !== "running") return { error: "Phòng chưa ở trạng thái running." };

    type RoundQuestionWithRoundType = {
      id: string;
      match_round_id: string;
      target_player_id?: string | null;
      meta?: unknown;
      match_rounds: { round_type: string | null } | Array<{ round_type: string | null }> | null;
    };

    const { data: roundQuestionRow, error: rqError } = await olympia
      .from("round_questions")
      .select("id, match_round_id, target_player_id, meta, match_rounds(round_type)")
      .eq("id", roundQuestionId)
      .maybeSingle();

    traceInfo({
      traceId,
      action: "setCurrentQuestionAction",
      event: "db.round_questions",
      fields: { msSinceStart: Date.now() - startedAt },
    });
    if (rqError) return { error: rqError.message };
    if (!roundQuestionRow) return { error: "Không tìm thấy câu hỏi." };

    const roundQuestion = roundQuestionRow as unknown as RoundQuestionWithRoundType;
    const roundTypeJoin = Array.isArray(roundQuestion.match_rounds)
      ? (roundQuestion.match_rounds[0] ?? null)
      : roundQuestion.match_rounds;
    const resolvedRoundType = roundTypeJoin?.round_type ?? null;

    const isKhoiDong = resolvedRoundType === "khoi_dong";
    const isVcnv = resolvedRoundType === "vcnv";
    const khoiDongInfo = isKhoiDong
      ? parseKhoiDongCodeInfoFromMeta((roundQuestion as unknown as { meta?: unknown })?.meta)
      : null;

    // Nếu code là DKA- thì chắc chắn là thi chung, kể cả khi target_player_id đang bị dính từ lần trước.
    const isKhoiDongCommon = khoiDongInfo?.kind === "common";
    // isKhoiDongPersonal không cần dùng ở đây; luật bật chuông dựa vào isKhoiDongCommon.

    // Khởi động thi chung: reset khóa lượt mỗi câu để buzzer hoạt động đúng theo câu.
    if (isKhoiDong && isKhoiDongCommon) {
      const { error: resetErr } = await olympia
        .from("round_questions")
        .update({ target_player_id: null })
        .eq("id", roundQuestion.id);
      if (resetErr) {
        console.warn("[Olympia] reset target_player_id failed:", resetErr.message);
      }
    }

    // VCNV: reset target_player_id mỗi khi chọn câu để không dính người thắng/bị lock từ câu trước.
    if (isVcnv) {
      const { error: resetErr } = await olympia
        .from("round_questions")
        .update({ target_player_id: null })
        .eq("id", roundQuestion.id);
      if (resetErr) {
        console.warn("[Olympia] reset VCNV target_player_id failed:", resetErr.message);
      }
    }

    const { error: updateError } = await olympia
      .from("live_sessions")
      .update({
        current_round_id: roundQuestion.match_round_id,
        current_round_type: resolvedRoundType,
        current_round_question_id: roundQuestion.id,
        // Đổi câu luôn tự tắt màn chờ để hiển thị câu mới.
        question_state: "showing",
        // Không auto-start timer khi show câu; Host sẽ bấm Start riêng.
        timer_deadline: null,
        // Auto về "Câu hỏi": tắt overlay bảng điểm/đáp án khi show câu.
        show_scoreboard_overlay: false,
        show_answers_overlay: false,
        // Khởi động thi chung + CNV: chuông bật sẵn. Các trường hợp khác: mặc định tắt.
        buzzer_enabled: isVcnv || (isKhoiDong && isKhoiDongCommon),
      })
      .eq("id", session.id);

    traceInfo({
      traceId,
      action: "setCurrentQuestionAction",
      event: "db.live_sessions.update",
      fields: { msSinceStart: Date.now() - startedAt },
    });

    if (updateError) return { error: updateError.message };

    // Mỗi lần chọn câu: luôn insert reset để client lọc đúng theo mốc reset mới.
    // (UI hiện tại đã ẩn event_type=reset khỏi danh sách hiển thị.)
    const { error: resetErr } = await olympia.from("buzzer_events").insert({
      match_id: matchId,
      round_question_id: roundQuestion.id,
      player_id: null,
      event_type: "reset",
      result: null,
    });
    if (resetErr) {
      console.warn("[Olympia] insert buzzer reset failed:", resetErr.message);
    }

    // Host sync qua realtime/event; tránh revalidate host để giảm latency.

    console.info("[Olympia][Perf] setCurrentQuestionAction", {
      matchId,
      roundQuestionId,
      msTotal: Date.now() - startedAt,
    });
    traceInfo({
      traceId,
      action: "setCurrentQuestionAction",
      event: "end",
      fields: { msTotal: Date.now() - startedAt, matchId, roundQuestionId },
    });
    return { success: "Đã hiển thị câu hỏi." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật câu hỏi." };
  }
}

// Wrapper dùng trực tiếp cho <form action={...}> trong Server Component.
export async function setCurrentQuestionFormAction(formData: FormData): Promise<void> {
  await setCurrentQuestionAction({}, formData);
}

export async function advanceCurrentQuestionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const startedAt = Date.now();
    const traceId = getOrCreateTraceId(formData);
    traceInfo({
      traceId,
      action: "advanceCurrentQuestionAction",
      event: "start",
      fields: {
        matchId: readStringFormField(formData, "matchId"),
        direction: readStringFormField(formData, "direction"),
        payloadBytes: estimateFormDataPayloadBytes(formData),
      },
    });
    const { supabase } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = advanceQuestionSchema.safeParse({
      matchId: formData.get("matchId"),
      direction: formData.get("direction") ?? "next",
      durationMs: formData.get("durationMs") ? Number(formData.get("durationMs")) : undefined,
      autoShow: formData.get("autoShow"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin điều hướng câu hỏi." };
    }

    const { matchId, direction, durationMs, autoShow } = parsed.data;
    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select(
        "id, status, match_id, current_round_id, current_round_type, current_round_question_id, join_code"
      )
      .eq("match_id", matchId)
      .maybeSingle();

    traceInfo({
      traceId,
      action: "advanceCurrentQuestionAction",
      event: "db.live_sessions",
      fields: { msSinceStart: Date.now() - startedAt },
    });
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận chưa mở phòng live." };
    if (session.status !== "running") return { error: "Phòng chưa ở trạng thái running." };
    if (!session.current_round_id) return { error: "Chưa chọn vòng hiện tại." };

    type RoundQuestionRow = {
      id: string;
      order_index: number;
      target_player_id: string | null;
      meta: unknown;
    };

    const { data: currentQuestion, error: currentErr } = session.current_round_question_id
      ? await olympia
          .from("round_questions")
          .select("id, order_index, target_player_id, meta")
          .eq("id", session.current_round_question_id)
          .maybeSingle()
      : { data: null, error: null };
    if (currentErr) return { error: currentErr.message };

    const currentOrderIndex = (currentQuestion as unknown as RoundQuestionRow | null)?.order_index;

    const fetchFirstQuestion = async (): Promise<RoundQuestionRow | null> => {
      const { data, error } = await olympia
        .from("round_questions")
        .select("id, order_index, target_player_id, meta")
        .eq("match_round_id", session.current_round_id)
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as RoundQuestionRow | null;
    };

    const fetchLastQuestion = async (): Promise<RoundQuestionRow | null> => {
      const { data, error } = await olympia
        .from("round_questions")
        .select("id, order_index, target_player_id, meta")
        .eq("match_round_id", session.current_round_id)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as RoundQuestionRow | null;
    };

    const fetchNextByOrder = async (orderIndex: number): Promise<RoundQuestionRow | null> => {
      const { data, error } = await olympia
        .from("round_questions")
        .select("id, order_index, target_player_id, meta")
        .eq("match_round_id", session.current_round_id)
        .gt("order_index", orderIndex)
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as RoundQuestionRow | null;
    };

    const fetchPrevByOrder = async (orderIndex: number): Promise<RoundQuestionRow | null> => {
      const { data, error } = await olympia
        .from("round_questions")
        .select("id, order_index, target_player_id, meta")
        .eq("match_round_id", session.current_round_id)
        .lt("order_index", orderIndex)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as RoundQuestionRow | null;
    };

    let nextQuestion: RoundQuestionRow | null = null;
    try {
      if (typeof currentOrderIndex !== "number" || !Number.isFinite(currentOrderIndex)) {
        nextQuestion = await fetchFirstQuestion();
      } else if (direction === "next") {
        nextQuestion = await fetchNextByOrder(currentOrderIndex);
        // Nếu ở KD thi riêng (personal) và hết câu, không fallback sang câu khác - dừng lại.
        // Tránh nhảy sang câu DKA- hoặc thí sinh khác.
        if (!nextQuestion && session.current_round_type === "khoi_dong" && currentQuestion) {
          const currentRow = currentQuestion as unknown as {
            target_player_id?: string | null;
            meta?: unknown;
          };
          const currentInfo = parseKhoiDongCodeInfoFromMeta(
            (currentRow as { meta?: unknown })?.meta
          );
          const currentIsPersonal = Boolean(
            currentRow?.target_player_id || currentInfo?.kind === "personal"
          );
          if (currentIsPersonal) {
            // Hết câu KD thi riêng - ép màn chờ, không lấy câu khác
            const { error: endErr } = await olympia
              .from("live_sessions")
              .update({
                question_state: "hidden",
                timer_deadline: null,
                buzzer_enabled: false,
              })
              .eq("id", session.id);
            if (endErr) return { error: endErr.message };
            revalidatePath(`/olympia/admin/matches/${matchId}/host`);
            return { success: "Đã hết câu của thí sinh này. Đã bật màn chờ." };
          }
        }
        // Nếu không ở KD personal, fallback sang câu cuối (dành cho KD chung hoặc vòng khác)
        nextQuestion = nextQuestion ?? (await fetchLastQuestion());
      } else {
        nextQuestion = (await fetchPrevByOrder(currentOrderIndex)) ?? (await fetchFirstQuestion());
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Không thể tải câu hỏi." };
    }

    if (!nextQuestion) return { error: "Vòng này chưa có câu hỏi." };

    // Khởi động: nếu đã ở câu cuối và bấm Next, tự bật màn chờ (kết thúc vòng KD).
    if (
      session.current_round_type === "khoi_dong" &&
      direction === "next" &&
      currentQuestion &&
      typeof currentOrderIndex === "number" &&
      Number.isFinite(currentOrderIndex) &&
      (nextQuestion as unknown as { id?: string }).id ===
        (currentQuestion as unknown as { id?: string }).id
    ) {
      const { error: endErr } = await olympia
        .from("live_sessions")
        .update({
          question_state: "hidden",
          timer_deadline: null,
          buzzer_enabled: false,
        })
        .eq("id", session.id);
      if (endErr) return { error: endErr.message };

      revalidatePath(`/olympia/admin/matches/${matchId}/host`);
      return { success: "Đã hết toàn bộ câu Khởi động, tự bật màn chờ." };
    }

    // Mặc định: chuyển câu -> nếu autoShow=1 thì show ngay, còn lại bật màn chờ (hidden).
    // Lưu ý: riêng Khởi động thi riêng, khi hết lượt của 1 thí sinh và chuyển sang người khác/thi chung
    // thì luôn bật màn chờ (không auto-show) để tránh nhảy câu người khác ngay.
    const shouldAutoShow = Boolean(autoShow);
    // Khởi động (thi riêng): khi sang câu của thí sinh khác hoặc sang thi chung,
    // không auto-show để tránh "nhảy" sang câu người khác ngay sau khi hết lượt.
    if (
      session.current_round_type === "khoi_dong" &&
      direction === "next" &&
      currentQuestion &&
      typeof currentOrderIndex === "number" &&
      Number.isFinite(currentOrderIndex)
    ) {
      const currentRow = currentQuestion as unknown as {
        target_player_id?: string | null;
        meta?: unknown;
      };
      const nextRow = nextQuestion as unknown as {
        target_player_id?: string | null;
        meta?: unknown;
      };

      const currentInfo = parseKhoiDongCodeInfoFromMeta((currentRow as { meta?: unknown })?.meta);
      const nextInfo = parseKhoiDongCodeInfoFromMeta((nextRow as { meta?: unknown })?.meta);

      // Nếu meta.code là DKA- thì luôn coi là thi chung (không phải personal),
      // kể cả khi target_player_id đang bị set do buzzer thắng.
      const currentIsCommon = currentInfo?.kind === "common";
      const nextIsCommon = nextInfo?.kind === "common";

      const currentIsPersonal =
        !currentIsCommon &&
        Boolean(currentRow?.target_player_id || currentInfo?.kind === "personal");
      const nextIsPersonal =
        !nextIsCommon && Boolean(nextRow?.target_player_id || nextInfo?.kind === "personal");

      const currentSeat = currentInfo && currentInfo.kind === "personal" ? currentInfo.seat : null;
      const nextSeat = nextInfo && nextInfo.kind === "personal" ? nextInfo.seat : null;

      const switchingPersonalToNonPersonal = currentIsPersonal && !nextIsPersonal;
      const switchingBetweenPersonalPlayers =
        currentIsPersonal &&
        nextIsPersonal &&
        (Boolean(
          currentRow?.target_player_id &&
          nextRow?.target_player_id &&
          currentRow.target_player_id !== nextRow.target_player_id
        ) ||
          Boolean(currentSeat != null && nextSeat != null && currentSeat !== nextSeat));

      // Nếu đang ở thi riêng (personal) và sang câu không cùng thí sinh, ép bật màn chờ.
      // Áp dụng cả khi autoShow=1 (chấm & chuyển) theo đúng luật/UX yêu cầu.
      // Trường hợp này bao gồm cả khi chuyển sang câu thi chung (DKA-) —
      // tránh tự nhảy sang câu khác khi đã kết thúc lượt của thí sinh.
      if (switchingPersonalToNonPersonal || switchingBetweenPersonalPlayers) {
        // Theo UX: hết câu của thí sinh hiện tại thì không tự nhảy sang thí sinh khác.
        // Chỉ bật màn chờ để host chủ động chọn thí sinh/câu tiếp theo.
        const { error: waitErr } = await olympia
          .from("live_sessions")
          .update({ question_state: "hidden", timer_deadline: null, buzzer_enabled: false })
          .eq("id", session.id);
        if (waitErr) return { error: waitErr.message };

        console.info(
          "[Olympia][Perf] advanceCurrentQuestionAction(khoi_dong stop at player boundary)",
          {
            matchId,
            direction,
            msTotal: Date.now() - startedAt,
          }
        );

        return { success: "Đã hết câu của thí sinh hiện tại. Đã bật màn chờ." };
      }

      // Khởi động thi chung (DKA- → DKA-): luôn auto-advance như bình thường
      // (không ép màn chờ, để autoShow logic áp dụng bình thường).
    }

    // Không auto-start timer khi chuyển câu, kể cả autoShow; Host sẽ bấm Start riêng.
    const timerDeadline = null;
    const nextQuestionState = shouldAutoShow ? "showing" : "hidden";

    const nextInfo =
      session.current_round_type === "khoi_dong"
        ? parseKhoiDongCodeInfoFromMeta((nextQuestion as unknown as { meta?: unknown })?.meta)
        : null;
    const nextIsKhoiDongCommon =
      session.current_round_type === "khoi_dong" && nextInfo?.kind === "common";
    // nextIsKhoiDongPersonal không cần dùng; chỉ cần phân biệt thi chung để bật chuông.

    // Khởi động thi chung: reset khóa lượt để buzzer reset theo câu.
    if (session.current_round_type === "khoi_dong" && nextIsKhoiDongCommon) {
      const { error: resetErr } = await olympia
        .from("round_questions")
        .update({ target_player_id: null })
        .eq("id", nextQuestion.id);
      if (resetErr) {
        console.warn("[Olympia] reset target_player_id failed:", resetErr.message);
      }
    }

    // VCNV: khi chuyển câu, phải reset target_player_id để không bị dính người bấm chuông của câu trước.
    if (session.current_round_type === "vcnv") {
      const { error: resetErr } = await olympia
        .from("round_questions")
        .update({ target_player_id: null })
        .eq("id", nextQuestion.id);
      if (resetErr) {
        console.warn("[Olympia] reset VCNV target_player_id failed:", resetErr.message);
      }
    }

    const nextBuzzerEnabled =
      nextQuestionState === "showing" &&
      ((session.current_round_type === "khoi_dong" && nextIsKhoiDongCommon) ||
        session.current_round_type === "vcnv");

    const { error: updateError } = await olympia
      .from("live_sessions")
      .update({
        current_round_question_id: nextQuestion.id,
        // Khi chuyển câu: mặc định bật màn chờ (hidden) + tắt chuông. Nếu autoShow=1 thì hiển thị ngay.
        question_state: nextQuestionState,
        timer_deadline: timerDeadline,
        buzzer_enabled: nextBuzzerEnabled,
      })
      .eq("id", session.id);

    traceInfo({
      traceId,
      action: "advanceCurrentQuestionAction",
      event: "db.live_sessions.update",
      fields: { msSinceStart: Date.now() - startedAt },
    });

    if (updateError) return { error: updateError.message };

    // Mỗi lần đổi câu: luôn insert 1 reset event để client lọc buzzer events theo mốc reset mới.
    const didChangeQuestion =
      !(currentQuestion as unknown as { id?: string } | null)?.id ||
      (currentQuestion as unknown as { id?: string } | null)?.id !== nextQuestion.id;
    if (didChangeQuestion) {
      const { error: resetErr } = await olympia.from("buzzer_events").insert({
        match_id: session.match_id,
        round_question_id: nextQuestion.id,
        player_id: null,
        event_type: "reset",
        result: null,
      });
      if (resetErr) {
        console.warn("[Olympia] insert buzzer reset failed:", resetErr.message);
      }
    }

    // Host sync qua realtime/event; tránh revalidate host để giảm latency.

    console.info("[Olympia][Perf] advanceCurrentQuestionAction", {
      matchId,
      direction,
      autoShow,
      shouldAutoShow,
      durationMs,
      msTotal: Date.now() - startedAt,
    });

    traceInfo({
      traceId,
      action: "advanceCurrentQuestionAction",
      event: "end",
      fields: { msTotal: Date.now() - startedAt, matchId, shouldAutoShow },
    });
    return {
      success: shouldAutoShow ? "Đã chuyển & hiển thị câu mới." : "Đã chuyển câu & bật màn chờ.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể điều hướng câu hỏi." };
  }
}

export async function advanceCurrentQuestionFormAction(formData: FormData): Promise<void> {
  await advanceCurrentQuestionAction({}, formData);
}

export async function setRoundQuestionTargetPlayerAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = setRoundQuestionTargetSchema.safeParse({
      matchId: formData.get("matchId"),
      roundQuestionId: formData.get("roundQuestionId"),
      playerId: formData.get("playerId"),
      roundType: formData.get("roundType"),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      let errorMsg = "Thiếu thông tin target.";
      if (issue?.path?.includes("matchId")) {
        errorMsg = "Trận thi không hợp lệ hoặc không tìm thấy.";
      } else if (issue?.path?.includes("playerId")) {
        errorMsg = "Thí sinh không hợp lệ hoặc không được chọn.";
      } else if (issue?.path?.includes("roundQuestionId")) {
        errorMsg = "Câu hỏi không hợp lệ.";
      }
      return { error: errorMsg };
    }

    // Resolve matchId từ UUID, join_code, hoặc sessionId
    const realMatchId = await resolveMatchIdFromRaw(supabase, parsed.data.matchId);
    if (!realMatchId) {
      return { error: "Không tìm thấy trận khớp với ID hoặc mã vào." };
    }

    // Nếu có roundQuestionId cụ thể thì cập nhật target cho câu đó.
    // (Cho phép chọn ghế trước khi chọn câu → roundQuestionId có thể null.)
    if (parsed.data.roundQuestionId) {
      const { data: updatedRqs, error } = await olympia
        .from("round_questions")
        .update({ target_player_id: parsed.data.playerId })
        .eq("id", parsed.data.roundQuestionId)
        .select("id");
      if (error) return { error: error.message };
      if (!updatedRqs || updatedRqs.length === 0) {
        return { error: "Không tìm thấy câu hỏi để cập nhật thí sinh." };
      }
    } else if (parsed.data.roundType === "ve_dich" && parsed.data.playerId) {
      // Về đích: cho phép chọn thí sinh chính trước khi chọn câu.
      // Khi đó, set target_player_id cho 3 câu của thí sinh (theo order_index).
      const { data: playerRow, error: playerErr } = await olympia
        .from("match_players")
        .select("id, seat_index")
        .eq("match_id", realMatchId)
        .eq("id", parsed.data.playerId)
        .maybeSingle();
      if (playerErr) return { error: playerErr.message };
      const seatIndex = (playerRow as unknown as { seat_index?: unknown } | null)?.seat_index;
      const seat = typeof seatIndex === "number" ? seatIndex : null;
      if (!seat) {
        return { error: "Không xác định được ghế của thí sinh để gán Về đích." };
      }

      const { data: veDichRound, error: veDichRoundErr } = await olympia
        .from("match_rounds")
        .select("id")
        .eq("match_id", realMatchId)
        .eq("round_type", "ve_dich")
        .maybeSingle();
      if (veDichRoundErr) return { error: veDichRoundErr.message };
      if (!veDichRound?.id) return { error: "Không tìm thấy vòng Về đích." };

      const { data: rqRows, error: rqErr } = await olympia
        .from("round_questions")
        .select("id, order_index, question_set_item_id")
        .eq("match_round_id", veDichRound.id);
      if (rqErr) return { error: rqErr.message };

      const range = getVeDichSlotRangeForSeat(seat);
      const mine = (rqRows ?? []).filter((rq) => {
        const orderIndex = (rq as unknown as { order_index?: unknown }).order_index;
        return getVeDichSeatFromOrderIndex(orderIndex) === seat;
      });
      if (mine.length < 3) {
        return {
          error: `Không tìm thấy đủ 3 slot Về đích cho Ghế ${seat} (order_index ${range.start}..${range.end}).`,
        };
      }

      // Cho phép chọn lại thí sinh/ghế ngay cả khi đã chốt gói.
      // Mục tiêu ở host: chuyển qua lại giữa các ghế để điều khiển/preview câu,
      // không phải "đổi" gói đã chốt. Không đụng tới question_set_item_id.

      const updates = mine
        .slice()
        .sort((a, b) => ((a.order_index ?? 0) as number) - ((b.order_index ?? 0) as number))
        .slice(0, 3)
        .map((rq) =>
          olympia
            .from("round_questions")
            .update({ target_player_id: parsed.data.playerId })
            .eq("id", (rq as unknown as { id: string }).id)
        );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) return { error: firstError.message };
    } else if (parsed.data.roundType === "ve_dich" && !parsed.data.playerId) {
      // Về đích: reset thành thi chung → clear target_player_id và question_set_item_id
      const { data: veDichRound, error: veDichRoundErr } = await olympia
        .from("match_rounds")
        .select("id")
        .eq("match_id", realMatchId)
        .eq("round_type", "ve_dich")
        .maybeSingle();
      if (veDichRoundErr) return { error: veDichRoundErr.message };
      if (veDichRound?.id) {
        const { error: clearErr } = await olympia
          .from("round_questions")
          .update({ target_player_id: null, question_set_item_id: null })
          .eq("match_round_id", veDichRound.id);
        if (clearErr) return { error: clearErr.message };
      }
    }

    // Nếu hành động thay đổi target ở cấp vòng (không chỉ cập nhật 1 câu cụ thể),
    // thì mới reset phiên live sang màn chờ. Nếu chỉ cập nhật `roundQuestionId`
    // (gán target cho 1 câu), không nên reset toàn bộ phiên live vì sẽ
    // làm mất câu đang hiển thị và bật màn chờ không mong muốn.
    if (!parsed.data.roundQuestionId) {
      const { error: resetErr } = await olympia
        .from("live_sessions")
        .update({
          current_round_question_id: null,
          question_state: "hidden",
          timer_deadline: null,
          buzzer_enabled: false,
        })
        .eq("match_id", realMatchId)
        .eq("status", "running");
      if (resetErr) return { error: resetErr.message };
    }
    // Nếu không có phòng running, không cần báo lỗi (có thể chưa mở phòng, chỉ setup thôi)

    // UI client/guest/mc đã cập nhật qua Supabase Realtime + polling.

    return {
      success: parsed.data.playerId
        ? "Đã đặt thi riêng cho thí sinh."
        : "Đã chuyển sang vòng thi chung.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật target." };
  }
}

export async function setRoundQuestionTargetPlayerFormAction(formData: FormData): Promise<void> {
  await setRoundQuestionTargetPlayerAction({}, formData);
}
