"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractRequiredAssetBasenames,
  normalizeAssetBasename,
  parseQuestionSetWorkbook,
} from "@/lib/olympia/question-set-workbook";
import { z } from "zod";
import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";
import { getServerAuthContext, getServerSupabase } from "@/lib/server-auth";
import {
  computeKhoiDongCommonScore,
  computeTangTocAwards,
  computeVcnvFinalScore,
} from "@/lib/olympia-scoring";

export type ActionState = {
  error?: string | null;
  success?: string | null;
  data?: Record<string, unknown> | null;
};

async function requireOlympiaAdminContext(): Promise<{
  supabase: SupabaseClient;
  appUserId: string;
}> {
  const { supabase, appUserId } = await getServerAuthContext();
  if (!appUserId) throw new Error("FORBIDDEN_OLYMPIA_ADMIN");

  const olympia = supabase.schema("olympia");
  const { data, error } = await olympia
    .from("participants")
    .select("role")
    .eq("user_id", appUserId)
    .maybeSingle();
  if (error || !data || data.role !== "AD") {
    throw new Error("FORBIDDEN_OLYMPIA_ADMIN");
  }

  return { supabase, appUserId };
}

function generateRoomPassword() {
  return randomBytes(3).toString("hex").toUpperCase();
}

function hashPassword(raw: string) {
  return createHash("sha256").update(raw.toUpperCase()).digest("hex");
}

function isPasswordMatch(stored: string | null | undefined, provided: string) {
  if (!stored) return false;
  const hashed = hashPassword(provided);
  return stored === hashed;
}

const matchSchema = z.object({
  name: z.string().min(3, "Tên trận tối thiểu 3 ký tự"),
  tournamentId: z
    .string()
    .uuid("ID giải đấu không hợp lệ.")
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? val : null)),
  scheduledAt: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val).toISOString() : null)),
});

const questionSchema = z.object({
  code: z.string().min(3, "Mã câu hỏi tối thiểu 3 ký tự").max(16),
  category: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val : null)),
  questionText: z.string().min(10, "Nội dung câu hỏi quá ngắn"),
  answerText: z.string().min(1, "Cần có đáp án"),
  note: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val : null)),
});

const questionSetUploadSchema = z.object({
  name: z.string().min(3, "Tên bộ đề tối thiểu 3 ký tự"),
});

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

const manualEditScoreSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  playerId: z.string().uuid("ID thí sinh không hợp lệ."),
  newTotal: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : Number.parseInt(String(v), 10)))
    .refine((n) => Number.isFinite(n), "Điểm không hợp lệ.")
    .transform((n) => Math.trunc(n)),
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

const resetMatchScoresSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
});

const resetLiveSessionSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
});

const MAX_QUESTION_SET_FILE_SIZE = 5 * 1024 * 1024; // 5MB safety limit

/**
 * Map question code prefix to round_type.
 * KD* → khoi_dong, VCNV* → vcnv, TT* → tang_toc, VD* → ve_dich
 */
function parseQuestionRoundType(code: string): string | null {
  const upper = code.toUpperCase().trim();
  if (upper.startsWith("KD")) return "khoi_dong";
  if (upper.startsWith("DKA")) return "khoi_dong";
  if (upper.startsWith("VCNV") || upper.startsWith("CNV")) return "vcnv";
  if (upper.startsWith("TT")) return "tang_toc";
  if (upper.startsWith("VD")) return "ve_dich";
  return null;
}

// parseQuestionSetWorkbook đã được tách ra module dùng chung (server + client)

const joinSchema = z.object({
  joinCode: z
    .string()
    .min(4, "Mã tối thiểu 4 ký tự")
    .max(32, "Mã tối đa 32 ký tự")
    .transform((val) => val.trim().toUpperCase()),
  playerPassword: z
    .string()
    .optional()
    .transform((val) => val?.trim().toUpperCase() ?? ""),
});

const mcPasswordSchema = z.object({
  joinCode: z
    .string()
    .min(1, "Vui lòng nhập mã phòng")
    .max(20, "Mã phòng quá dài")
    .transform((val) => val.trim().toUpperCase()),
  mcPassword: z
    .string()
    .min(4, "Mật khẩu tối thiểu 4 ký tự")
    .max(64, "Mật khẩu quá dài")
    .transform((val) => val.trim()),
});

const matchIdSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
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

const decisionSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  playerId: z.string().uuid("Thí sinh không hợp lệ."),
  decision: z.enum(["correct", "wrong", "timeout"]),
});

const guestMediaControlSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  mediaType: z.enum(["audio", "video"]),
  command: z.enum(["play", "pause", "restart"]),
});

type GuestMediaCommand = {
  commandId: number;
  action: "play" | "pause" | "restart";
  issuedAt: string;
};

type GuestMediaControl = {
  version?: number;
  audio?: GuestMediaCommand;
  video?: GuestMediaCommand;
};

const decisionAndAdvanceSchema = decisionSchema.extend({
  matchId: z.string().uuid("Trận không hợp lệ."),
  // durationMs theo luật từng vòng (vòng 1: 5s, vòng 4: 15/20s). Nếu thiếu sẽ dùng default của advance.
  durationMs: z.number().int().min(1000).max(120000).optional(),
});

const setCurrentQuestionSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
  roundQuestionId: z.string().uuid("Câu hỏi không hợp lệ."),
  durationMs: z.number().int().min(1000).max(120000).optional().default(5000),
});

const vcnvRowDecisionSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  playerId: z.string().uuid("Thí sinh không hợp lệ."),
  decision: z.enum(["correct", "wrong", "timeout"]),
});

const obstacleGuessHostSubmitSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  playerId: z.string().uuid("Thí sinh không hợp lệ."),
  guessText: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Vui lòng nhập dự đoán CNV."),
});

const obstacleGuessConfirmSchema = z.object({
  answerId: z.string().uuid("Đáp án không hợp lệ."),
  decision: z.enum(["correct", "wrong"]),
});

const markAnswerCorrectnessSchema = z.object({
  answerId: z.string().uuid("Đáp án không hợp lệ."),
  decision: z.enum(["correct", "wrong"]),
});

const autoScoreTangTocSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
});

const veDichValueSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
  roundQuestionId: z.string().uuid("Câu hỏi không hợp lệ."),
  value: z
    .number()
    .int()
    .refine((v) => v === 20 || v === 30, "Giá trị câu chỉ nhận 20 hoặc 30."),
  // Tuỳ chọn: khi set giá trị câu, đồng thời ấn định thí sinh chính cho câu này
  playerId: z
    .union([z.string().uuid("Thí sinh không hợp lệ."), z.literal("")])
    .optional()
    .transform((val) => (val ? val : null)),
});

const setRoundQuestionTargetSchema = z.object({
  matchId: z.string().min(1, "Trận không hợp lệ."), // Allow any non-empty string (UUID, join_code, etc.)
  roundQuestionId: z
    .union([z.string().uuid("Câu hỏi không hợp lệ."), z.literal("")])
    .transform((val) => (val ? val : null)),
  // Cho phép bỏ chọn ("Thi chung") bằng cách gửi chuỗi rỗng.
  playerId: z
    .union([z.string().uuid("Thí sinh không hợp lệ."), z.literal("")])
    .transform((val) => (val ? val : null)),
  // Phân biệt trường hợp chọn thí sinh trước khi chọn câu (chỉ dùng cho Về đích).
  roundType: z
    .union([z.enum(["khoi_dong", "vcnv", "tang_toc", "ve_dich"]), z.literal(""), z.undefined()])
    .optional()
    .transform((val) => (val ? val : null)),
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

const decisionBatchSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  itemsJson: z.string().min(2, "Thiếu danh sách chấm."),
});

const decisionBatchItemsSchema = z
  .array(
    z.object({
      playerId: z.string().uuid("Thí sinh không hợp lệ."),
      decision: z.enum(["correct", "wrong", "timeout"]),
    })
  )
  .max(10);

const toggleStarSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
  roundQuestionId: z.string().uuid("Câu hỏi không hợp lệ."),
  playerId: z.string().uuid("Thí sinh không hợp lệ."),
  enabled: z
    .string()
    .optional()
    .transform((val) => val === "1"),
});

const openStealWindowSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
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
  if (!meta || typeof meta !== "object") return 15000;
  const raw = (meta as Record<string, unknown>).ve_dich_value;
  const val = typeof raw === "number" ? raw : Number(raw);
  return val === 30 ? 20000 : 15000;
}

const confirmVeDichMainSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  decision: z.enum(["correct", "wrong", "timeout"]),
});

const confirmVeDichStealSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  decision: z.enum(["correct", "wrong", "timeout"]),
});

function generateJoinCode() {
  return `OLY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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

export async function createMatchAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");
    if (!appUserId) return { error: "Không tìm thấy thông tin người dùng." };

    const parsed = matchSchema.safeParse({
      name: formData.get("name"),
      tournamentId: formData.get("tournamentId"),
      scheduledAt: formData.get("scheduledAt"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
    }

    const payload = parsed.data;
    const { data: createdMatch, error: insertError } = await olympia
      .from("matches")
      .insert({
        name: payload.name,
        tournament_id: payload.tournamentId,
        scheduled_at: payload.scheduledAt,
        status: "draft",
        host_user_id: appUserId,
      })
      .select("id")
      .maybeSingle();

    if (insertError) return { error: insertError.message };
    if (!createdMatch?.id) return { error: "Không thể tạo trận mới." };

    // Tự động khởi tạo cấu hình vòng (match_rounds) cho trận mới.
    const matchId = createdMatch.id;
    const { data: existingRounds, error: checkRoundsError } = await olympia
      .from("match_rounds")
      .select("id")
      .eq("match_id", matchId)
      .limit(1);
    if (checkRoundsError) {
      return {
        error: `Đã tạo trận nhưng không thể kiểm tra vòng thi: ${checkRoundsError.message}`,
      };
    }

    if (!existingRounds || existingRounds.length === 0) {
      const roundTypes = [
        { roundType: "khoi_dong", orderIndex: 0 },
        { roundType: "vcnv", orderIndex: 1 },
        { roundType: "tang_toc", orderIndex: 2 },
        { roundType: "ve_dich", orderIndex: 3 },
      ];

      const { error: insertRoundsError } = await olympia.from("match_rounds").insert(
        roundTypes.map((round) => ({
          match_id: matchId,
          round_type: round.roundType,
          order_index: round.orderIndex,
          config: {},
        }))
      );

      if (insertRoundsError) {
        return {
          error: `Đã tạo trận nhưng không thể khởi tạo cấu hình vòng: ${insertRoundsError.message}`,
        };
      }
    }

    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    revalidatePath(`/olympia/admin/matches/${createdMatch.id}`);
    revalidatePath(`/olympia/admin/matches/${createdMatch.id}/host`);

    return { success: "Đã tạo trận mới và khởi tạo cấu hình 4 vòng thi." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể tạo trận." };
  }
}

export async function createQuestionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");
    const parsed = questionSchema.safeParse({
      code: formData.get("code"),
      category: formData.get("category"),
      questionText: formData.get("questionText"),
      answerText: formData.get("answerText"),
      note: formData.get("note"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu câu hỏi không hợp lệ." };
    }

    const payload = parsed.data;
    const defaultSetName = "Kho đề (tạo tay)";

    const { data: existingSet, error: existingSetError } = await olympia
      .from("question_sets")
      .select("id")
      .eq("name", defaultSetName)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existingSetError) return { error: existingSetError.message };

    const setId = existingSet?.id
      ? existingSet.id
      : (
          await olympia
            .from("question_sets")
            .insert({
              name: defaultSetName,
              item_count: 0,
              original_filename: null,
              uploaded_by: appUserId ?? null,
            })
            .select("id")
            .maybeSingle()
        ).data?.id;

    if (!setId) return { error: "Không thể tạo bộ đề mặc định để lưu câu hỏi." };

    const { data: lastItem, error: lastItemError } = await olympia
      .from("question_set_items")
      .select("order_index")
      .eq("question_set_id", setId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastItemError) return { error: lastItemError.message };

    const nextOrderIndex = (lastItem?.order_index ?? -1) + 1;

    const { error } = await olympia.from("question_set_items").insert({
      question_set_id: setId,
      code: payload.code.toUpperCase(),
      category: payload.category,
      question_text: payload.questionText,
      answer_text: payload.answerText,
      note: payload.note,
      submitted_by: appUserId ?? null,
      source: null,
      image_url: null,
      audio_url: null,
      order_index: nextOrderIndex,
    });

    if (error) return { error: error.message };

    await olympia
      .from("question_sets")
      .update({ item_count: nextOrderIndex + 1 })
      .eq("id", setId);

    revalidatePath("/olympia/admin/question-bank");
    return { success: "Đã thêm câu hỏi." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể tạo câu hỏi." };
  }
}

export async function uploadQuestionSetAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsedName = questionSetUploadSchema.safeParse({ name: formData.get("name") });
    if (!parsedName.success) {
      return { error: parsedName.error.issues[0]?.message ?? "Tên bộ đề không hợp lệ." };
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return { error: "Cần tải lên file .xlsx theo mẫu." };
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return { error: "Chỉ hỗ trợ tập tin .xlsx không có hàng tiêu đề." };
    }

    if (file.size <= 0) {
      return { error: "File trống, vui lòng kiểm tra lại." };
    }

    if (file.size > MAX_QUESTION_SET_FILE_SIZE) {
      return { error: "File vượt quá giới hạn 5MB, vui lòng tách nhỏ bộ đề." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { items, skipped } = await parseQuestionSetWorkbook(buffer);

    if (items.length === 0) {
      return { error: "Không có câu hỏi hợp lệ trong file đã tải lên." };
    }

    type AssetManifestEntry = { name: string; path: string; publicUrl: string };
    const rawManifest = formData.get("assetManifest");
    const assetManifest: Record<string, AssetManifestEntry> =
      typeof rawManifest === "string" && rawManifest.trim().length > 0
        ? (JSON.parse(rawManifest) as Record<string, AssetManifestEntry>)
        : {};

    const requiredAssets = extractRequiredAssetBasenames(items);
    if (requiredAssets.length > 0) {
      const missing = requiredAssets
        .filter((name) => !assetManifest[name.toLowerCase()])
        .slice(0, 20);
      if (missing.length > 0) {
        return {
          error:
            missing.length === 1
              ? `Thiếu tài nguyên: ${missing[0]}. Vui lòng tải thư mục tài nguyên trước khi submit.`
              : `Thiếu ${missing.length} tài nguyên (ví dụ: ${missing.join(", ")}). Vui lòng tải thư mục tài nguyên trước khi submit.`,
        };
      }
    }

    const { data: createdSet, error: insertSetError } = await olympia
      .from("question_sets")
      .insert({
        name: parsedName.data.name,
        original_filename: file.name,
        item_count: items.length,
        uploaded_by: appUserId ?? null,
      })
      .select("id")
      .maybeSingle();

    if (insertSetError) return { error: insertSetError.message };
    if (!createdSet) return { error: "Không thể lưu bộ đề." };

    const batchSize = 500;
    for (let i = 0; i < items.length; i += batchSize) {
      const slice = items.slice(i, i + batchSize).map((item) => {
        const imageBase = item.image_url ? normalizeAssetBasename(item.image_url) : "";
        const audioBase = item.audio_url ? normalizeAssetBasename(item.audio_url) : "";

        return {
          question_set_id: createdSet.id,
          ...item,
          image_url:
            imageBase && assetManifest[imageBase.toLowerCase()]
              ? assetManifest[imageBase.toLowerCase()]!.publicUrl
              : item.image_url,
          audio_url:
            audioBase && assetManifest[audioBase.toLowerCase()]
              ? assetManifest[audioBase.toLowerCase()]!.publicUrl
              : item.audio_url,
        };
      });

      const { error } = await olympia.from("question_set_items").insert(slice);
      if (error) return { error: error.message };
    }

    revalidatePath("/olympia/admin/question-bank");
    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");

    const skippedMsg = skipped > 0 ? `, bỏ qua ${skipped} dòng không hợp lệ/trùng mã` : "";
    return {
      success: `Đã tạo bộ đề "${parsedName.data.name}" với ${items.length} câu${skippedMsg}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể tải bộ đề." };
  }
}

export async function lookupJoinCodeAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { authUid, supabase } = await getServerAuthContext();
    if (!authUid) return { error: "Bạn cần đăng nhập để tham gia phòng." };

    const parsed = joinSchema.safeParse({
      joinCode: formData.get("joinCode"),
      playerPassword: formData.get("playerPassword"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Mã tham gia không hợp lệ." };
    }

    // Get public.users.id from auth_uid (needed for FK constraint in session_verifications)
    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("auth_uid", authUid)
      .maybeSingle();

    if (userError) return { error: userError.message };
    if (!userRecord) {
      // User record does not exist yet - may be due to trigger delay, skip session verification for now
      console.warn("[Olympia] User record not found for auth_uid:", authUid);
    }

    const olympia = supabase.schema("olympia");
    const { data, error } = await olympia
      .from("live_sessions")
      .select(
        "id, status, match_id, question_state, current_round_type, player_password, requires_player_password"
      )
      .eq("join_code", parsed.data.joinCode)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!data) return { error: "Không tìm thấy phòng với mã này." };
    if (data.status === "ended") return { error: "Phòng thi đã kết thúc." };

    const requiresPassword = data.requires_player_password !== false;
    if (requiresPassword) {
      if (!parsed.data.playerPassword || parsed.data.playerPassword.length === 0) {
        return { error: "Phòng yêu cầu mật khẩu thí sinh." };
      }
      if (!isPasswordMatch(data.player_password, parsed.data.playerPassword)) {
        return { error: "Sai mật khẩu thí sinh." };
      }
    }

    // Record verification on server for cross-device persistence (only if user record exists)
    if (userRecord?.id) {
      const { error: verifyError } = await olympia.from("session_verifications").upsert(
        {
          session_id: data.id,
          user_id: userRecord.id,
          verified_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "session_id,user_id" }
      );

      if (verifyError) {
        console.error("[Olympia] Failed to record session verification:", verifyError);
        // Continue anyway - verification is secondary
      }
    }

    return {
      success:
        `Phòng đang chạy (round: ${data.current_round_type ?? "N/A"}, trạng thái: ${data.question_state}).` as const,
      data: { sessionId: data.id },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể kiểm tra mã tham gia." };
  }
}

export async function verifyMcPasswordAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const parsed = mcPasswordSchema.safeParse({
      joinCode: formData.get("joinCode"),
      mcPassword: formData.get("mcPassword"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Mã phòng hoặc mật khẩu không hợp lệ." };
    }

    const supabase = await getServerSupabase();
    const olympia = supabase.schema("olympia");
    const { data: session, error } = await olympia
      .from("live_sessions")
      .select("id, match_id, mc_view_password, status")
      .eq("join_code", parsed.data.joinCode)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!session) return { error: "Không tìm thấy phòng với mã này." };

    if (!session.mc_view_password) {
      return { error: "Phòng chưa cấu hình mật khẩu MC." };
    }

    if (!isPasswordMatch(session.mc_view_password, parsed.data.mcPassword)) {
      return { error: "Sai mật khẩu MC." };
    }

    if (session.status !== "running") {
      return {
        success: "Mật khẩu đúng, nhưng phòng chưa chạy. Bạn vẫn có thể xem chế độ chuẩn bị.",
        data: { joinCode: parsed.data.joinCode, matchId: session.match_id },
      };
    }

    return {
      success: "Đã mở khóa chế độ xem MC.",
      data: { joinCode: parsed.data.joinCode, matchId: session.match_id },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể xác thực mật khẩu MC." };
  }
}

export async function openLiveSessionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");
    const parsed = matchIdSchema.safeParse({ matchId: formData.get("matchId") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin trận." };
    }

    const matchId = parsed.data.matchId;
    const { data: match, error: matchError } = await olympia
      .from("matches")
      .select("id, status")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) return { error: matchError.message };
    if (!match) return { error: "Không tìm thấy trận." };

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, join_code, status")
      .eq("match_id", matchId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };

    const joinCode = session?.join_code ?? generateJoinCode();
    const playerPasswordPlain = generateRoomPassword();
    const mcPasswordPlain = generateRoomPassword();
    const hashedPlayerPassword = hashPassword(playerPasswordPlain);
    const hashedMcPassword = hashPassword(mcPasswordPlain);

    if (!session) {
      const { error } = await olympia.from("live_sessions").insert({
        match_id: matchId,
        join_code: joinCode,
        status: "running",
        created_by: appUserId,
        player_password: hashedPlayerPassword,
        mc_view_password: hashedMcPassword,
        requires_player_password: true,
      });
      if (error) return { error: error.message };
    } else {
      const { error } = await olympia
        .from("live_sessions")
        .update({
          status: "running",
          join_code: joinCode,
          question_state: "hidden",
          current_round_id: null,
          current_round_question_id: null,
          timer_deadline: null,
          ended_at: null,
          player_password: hashedPlayerPassword,
          mc_view_password: hashedMcPassword,
          requires_player_password: true,
        })
        .eq("id", session.id);
      if (error) return { error: error.message };
    }

    if (match.status !== "live") {
      const { error } = await olympia.from("matches").update({ status: "live" }).eq("id", matchId);
      if (error) return { error: error.message };
    }

    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    revalidatePath("/olympia/client");

    // Record password generation in history
    const { error: historyError } = await olympia.from("session_password_history").insert({
      session_id: session
        ? session.id
        : (await olympia.from("live_sessions").select("id").eq("match_id", matchId).maybeSingle())
            .data?.id,
      player_password_hash: hashedPlayerPassword,
      mc_view_password_hash: hashedMcPassword,
      player_password_plain: playerPasswordPlain,
      mc_password_plain: mcPasswordPlain,
      generated_by: appUserId,
      is_current: true,
    });

    if (historyError) {
      console.error("[Olympia] Failed to record password history:", historyError);
    }

    return {
      success: `Đã mở phòng. Mã tham gia: ${joinCode}. Mật khẩu thí sinh: ${playerPasswordPlain} Mật khẩu MC: ${mcPasswordPlain}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể mở phòng thi." };
  }
}

const regeneratePasswordSchema = z.object({
  sessionId: z.string().uuid("Session ID không hợp lệ"),
});

export async function getSessionPasswordAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = regeneratePasswordSchema.safeParse({
      sessionId: formData.get("sessionId"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Session ID không hợp lệ." };
    }

    const { data: passwordHistory, error: historyError } = await olympia
      .from("session_password_history")
      .select("player_password_plain, mc_password_plain")
      .eq("session_id", parsed.data.sessionId)
      .eq("is_current", true)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (historyError) return { error: historyError.message };
    if (!passwordHistory) return { error: "Không tìm thấy mật khẩu. Vui lòng mở phòng trước." };

    return {
      success: `Mật khẩu thí sinh: ${passwordHistory.player_password_plain} Mật khẩu MC: ${passwordHistory.mc_password_plain}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể lấy mật khẩu." };
  }
}

export async function regenerateSessionPasswordAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = regeneratePasswordSchema.safeParse({
      sessionId: formData.get("sessionId"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Session ID không hợp lệ." };
    }

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();

    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Không tìm thấy phòng." };

    // Generate new passwords
    const playerPasswordPlain = generateRoomPassword();
    const mcPasswordPlain = generateRoomPassword();
    const hashedPlayerPassword = hashPassword(playerPasswordPlain);
    const hashedMcPassword = hashPassword(mcPasswordPlain);

    // Update session with new passwords
    const { error: updateError } = await olympia
      .from("live_sessions")
      .update({
        player_password: hashedPlayerPassword,
        mc_view_password: hashedMcPassword,
      })
      .eq("id", parsed.data.sessionId);

    if (updateError) return { error: updateError.message };

    // Record old passwords as inactive in history
    const { error: historyError } = await olympia
      .from("session_password_history")
      .update({ is_current: false })
      .eq("session_id", parsed.data.sessionId)
      .eq("is_current", true);

    if (historyError) {
      console.error("[Olympia] Failed to update password history:", historyError);
    }

    // Record new passwords in history
    const { error: newHistoryError } = await olympia.from("session_password_history").insert({
      session_id: parsed.data.sessionId,
      player_password_hash: hashedPlayerPassword,
      mc_view_password_hash: hashedMcPassword,
      player_password_plain: playerPasswordPlain,
      mc_password_plain: mcPasswordPlain,
      generated_by: appUserId,
      is_current: true,
    });

    if (newHistoryError) {
      console.error("[Olympia] Failed to record new password history:", newHistoryError);
    }

    revalidatePath("/olympia/admin/matches");

    return {
      success: `Đã sinh lại mật khẩu. Mật khẩu thí sinh: ${playerPasswordPlain} Mật khẩu MC: ${mcPasswordPlain}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể sinh lại mật khẩu." };
  }
}

export async function endLiveSessionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");
    const parsed = matchIdSchema.safeParse({ matchId: formData.get("matchId") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin trận." };
    }

    const matchId = parsed.data.matchId;
    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận này chưa có phòng live." };
    if (session.status === "ended") {
      return { error: "Phòng đã kết thúc trước đó." };
    }

    const endedAt = new Date().toISOString();

    const [{ error: liveError }, { error: matchError }] = await Promise.all([
      olympia
        .from("live_sessions")
        .update({ status: "ended", ended_at: endedAt })
        .eq("id", session.id),
      olympia.from("matches").update({ status: "finished" }).eq("id", matchId),
    ]);

    if (liveError) return { error: liveError.message };
    if (matchError) return { error: matchError.message };

    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    revalidatePath("/olympia/client");

    return { success: "Đã kết thúc phòng thi." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể kết thúc phòng thi." };
  }
}

export async function setLiveSessionRoundAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
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

    let durationMs = 5000;
    if (roundType === "khoi_dong") durationMs = 5000;
    else if (roundType === "vcnv") durationMs = 15000;
    else if (roundType === "ve_dich" && currentRqId) {
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
      // Theo luật: TT 1-2 = 20s, TT 3-4 = 30s.
      if (idx === 0 || idx === 1) durationMs = 20000;
      else if (idx === 2 || idx === 3) durationMs = 30000;
      else durationMs = 20000;
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
}

export async function expireSessionTimerAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
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
      .select("id, status, question_state, current_round_question_id")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();
    if (sessionErr) return { error: sessionErr.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (session.status !== "running") return { error: "Phòng chưa ở trạng thái running." };
    if (!session.current_round_question_id) return { error: "Chưa có câu hỏi đang hiển thị." };
    if (session.question_state !== "showing" && session.question_state !== "answer_revealed") {
      return { error: "Host chưa mở câu hỏi/cửa cướp để hết giờ." };
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

export async function resetMatchScoresAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = resetMatchScoresSchema.safeParse({
      matchId: formData.get("matchId"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin trận để reset điểm." };
    }

    const { matchId } = parsed.data;
    const now = new Date().toISOString();

    const { data: updatedRows, error } = await olympia
      .from("match_scores")
      .update({ points: 0, updated_at: now })
      .eq("match_id", matchId)
      .select("id");

    if (error) return { error: error.message };

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    revalidatePath(`/olympia/admin/matches/${matchId}`);

    if (!updatedRows || updatedRows.length === 0) {
      return { success: "Không có dữ liệu điểm để reset." };
    }

    return { success: "Đã reset điểm về 0." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể reset điểm." };
  }
}

export async function editMatchScoreManualAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
    if (!appUserId) return { error: "Bạn chưa đăng nhập." };

    const olympia = supabase.schema("olympia");

    const parsed = manualEditScoreSchema.safeParse({
      matchId: formData.get("matchId"),
      playerId: formData.get("playerId"),
      newTotal: formData.get("newTotal"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin chỉnh điểm." };
    }

    const { matchId, playerId, newTotal } = parsed.data;

    const now = new Date().toISOString();

    const { data: rows, error: rowsErr } = await olympia
      .from("match_scores")
      .select("id, round_type, points")
      .eq("match_id", matchId)
      .eq("player_id", playerId);

    if (rowsErr) return { error: rowsErr.message };

    const pointsBefore = (rows ?? []).reduce((acc, r) => acc + (r.points ?? 0), 0);
    const delta = newTotal - pointsBefore;

    if (delta === 0) {
      return { success: "Điểm không đổi." };
    }

    const manualRow = (rows ?? []).find((r) => String(r.round_type ?? "") === "manual") ?? null;

    if (manualRow?.id) {
      const nextPoints = (manualRow.points ?? 0) + delta;
      const { data: updated, error: updErr } = await olympia
        .from("match_scores")
        .update({ points: nextPoints, updated_at: now })
        .eq("id", manualRow.id)
        .select("id");
      if (updErr) return { error: updErr.message };
      if (!updated || updated.length === 0) return { error: "Không thể cập nhật điểm thủ công." };
    } else {
      const { data: inserted, error: insErr } = await olympia
        .from("match_scores")
        .insert({
          match_id: matchId,
          player_id: playerId,
          round_type: "manual",
          points: delta,
          updated_at: now,
        })
        .select("id");
      if (insErr) return { error: insErr.message };
      if (!inserted || inserted.length === 0) return { error: "Không thể ghi điểm thủ công." };
    }

    const pointsAfter = pointsBefore + delta;

    const { error: logErr } = await olympia.from("score_changes").insert({
      match_id: matchId,
      player_id: playerId,
      round_type: "manual",
      requested_delta: delta,
      applied_delta: delta,
      points_before: pointsBefore,
      points_after: pointsAfter,
      source: "manual",
      reason: null,
      round_question_id: null,
      answer_id: null,
      revert_of: null,
      reverted_at: null,
      reverted_by: null,
      created_by: appUserId,
    });

    if (logErr) return { error: logErr.message };

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    revalidatePath(`/olympia/admin/matches/${matchId}`);

    return { success: `Đã chỉnh điểm: ${pointsBefore} → ${pointsAfter}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể chỉnh điểm." };
  }
}

export async function resetLiveSessionAndScoresAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = resetLiveSessionSchema.safeParse({
      matchId: formData.get("matchId"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Thiếu thông tin trận để reset phiên live.",
      };
    }

    const { matchId } = parsed.data;
    const now = new Date().toISOString();

    // Chọn phiên live hiện tại (ưu tiên running; nếu không có thì pending).
    const { data: session, error: sessionErr } = await olympia
      .from("live_sessions")
      .select("id, status")
      .eq("match_id", matchId)
      .in("status", ["running", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionErr) return { error: sessionErr.message };
    if (!session?.id) return { error: "Không tìm thấy phiên live (running/pending) để reset." };

    // Reset trạng thái vòng/câu về như mới khởi tạo (không đổi status để tránh đá văng người xem).
    const { error: resetSessionErr } = await olympia
      .from("live_sessions")
      .update({
        question_state: "hidden",
        current_round_id: null,
        current_round_type: null,
        current_round_question_id: null,
        timer_deadline: null,
        buzzer_enabled: true,
        show_scoreboard_overlay: false,
        guest_media_control: {},
      })
      .eq("id", session.id);
    if (resetSessionErr) return { error: resetSessionErr.message };

    // Reset điểm về 0
    const { error: resetScoresErr } = await olympia
      .from("match_scores")
      .update({ points: 0, updated_at: now })
      .eq("match_id", matchId);
    if (resetScoresErr) return { error: resetScoresErr.message };

    // Reset dữ liệu gameplay để UI (đặc biệt VCNV) không dính trạng thái cũ:
    // - VCNV opened/lockedWrong được suy ra từ answers.is_correct != null
    // - Các màn hình khác có thể dính buzzer/star/score change log, v.v.
    const { error: resetDisqualifiedErr } = await olympia
      .from("match_players")
      .update({ is_disqualified_obstacle: false })
      .eq("match_id", matchId);
    if (resetDisqualifiedErr) return { error: resetDisqualifiedErr.message };

    // Xoá log thay đổi điểm trước để không vướng FK answer_id → answers.id.
    const { error: delScoreChangesErr } = await olympia
      .from("score_changes")
      .delete()
      .eq("match_id", matchId);
    if (delScoreChangesErr) return { error: delScoreChangesErr.message };

    const { error: delStarUsesErr } = await olympia
      .from("star_uses")
      .delete()
      .eq("match_id", matchId);
    if (delStarUsesErr) return { error: delStarUsesErr.message };

    const { error: delBuzzerErr } = await olympia
      .from("buzzer_events")
      .delete()
      .eq("match_id", matchId);
    if (delBuzzerErr) return { error: delBuzzerErr.message };

    const { error: delAnswersErr } = await olympia.from("answers").delete().eq("match_id", matchId);
    if (delAnswersErr) return { error: delAnswersErr.message };

    // Reset các gói Về đích: clear target_player_id và question_set_item_id
    const { data: rounds, error: roundsErr } = await olympia
      .from("match_rounds")
      .select("id")
      .eq("match_id", matchId)
      .eq("round_type", "ve_dich");
    if (roundsErr) return { error: roundsErr.message };

    if (rounds && rounds.length > 0) {
      for (const round of rounds) {
        const { error: resetVeDichErr } = await olympia
          .from("round_questions")
          .update({ target_player_id: null, question_set_item_id: null })
          .eq("match_round_id", (round as unknown as { id: string }).id);
        if (resetVeDichErr) return { error: resetVeDichErr.message };
      }
    }

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    revalidatePath(`/olympia/admin/matches/${matchId}`);

    return {
      success: "Đã reset phiên live + điểm + trạng thái trả lời (bao gồm VCNV) về mặc định.",
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Không thể reset phiên live + điểm.",
    };
  }
}

export async function submitAnswerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
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

    const { data: playerRow, error: playerError } = await olympia
      .from("match_players")
      .select("id, is_disqualified_obstacle")
      .eq("match_id", session.match_id)
      .eq("participant_id", appUserId)
      .maybeSingle();

    if (playerError) return { error: playerError.message };
    if (!playerRow) return { error: "Bạn không thuộc trận này." };

    // CNV: nếu đã bị loại quyền đoán CNV trong vòng này, không cho gửi đáp án từ khung nhập.
    if (session.current_round_type === "vcnv" && playerRow.is_disqualified_obstacle === true) {
      return { error: "Bạn đã bị loại quyền trả lời ở vòng CNV này." };
    }

    const { data: roundQuestion, error: rqError } = await olympia
      .from("round_questions")
      .select("id, match_round_id, target_player_id, meta, answer_text")
      .eq("id", session.current_round_question_id)
      .maybeSingle();

    if (rqError) return { error: rqError.message };
    if (!roundQuestion) return { error: "Không tìm thấy câu hỏi hiện tại." };

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

    if (insertError) {
      return { error: insertError.message };
    }

    return {
      success: "Đã ghi nhận đáp án. Host sẽ chấm và cập nhật điểm.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể gửi đáp án ngay lúc này." };
  }
}

export async function triggerBuzzerAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
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

    if (error) return { error: error.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (session.status !== "running") {
      return { error: "Phòng chưa sẵn sàng nhận tín hiệu buzzer." };
    }
    if (session.buzzer_enabled === false) {
      return { error: "Host đang tắt bấm chuông." };
    }
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };
    if (!session.current_round_question_id) return { error: "Chưa có câu hỏi đang hiển thị." };

    const isVeDichStealWindow =
      session.current_round_type === "ve_dich" && session.question_state === "answer_revealed";
    const canBuzzNow = session.question_state === "showing" || isVeDichStealWindow;
    if (!canBuzzNow) {
      return { error: "Host chưa mở câu hỏi/cửa cướp để nhận buzzer." };
    }

    const { data: playerRow, error: playerError } = await olympia
      .from("match_players")
      .select("id, is_disqualified_obstacle")
      .eq("match_id", session.match_id)
      .eq("participant_id", appUserId)
      .maybeSingle();

    if (playerError) return { error: playerError.message };
    if (!playerRow) return { error: "Bạn không thuộc trận này." };

    if (session.current_round_type === "vcnv" && playerRow.is_disqualified_obstacle === true) {
      return { error: "Bạn đã bị loại quyền đoán CNV ở vòng này." };
    }

    // Khởi động lượt cá nhân: không cho bấm chuông.
    const { data: rq, error: rqError } = await olympia
      .from("round_questions")
      .select("id, target_player_id, meta")
      .eq("id", session.current_round_question_id)
      .maybeSingle();
    if (rqError) return { error: rqError.message };
    if (!rq) return { error: "Không tìm thấy câu hỏi hiện tại." };
    const inferredKhoiDong =
      session.current_round_type === "khoi_dong" && !rq?.target_player_id
        ? parseKhoiDongCodeInfoFromMeta((rq as unknown as { meta?: unknown })?.meta)
        : null;

    if (rq?.target_player_id || inferredKhoiDong?.kind === "personal") {
      if (session.current_round_type === "ve_dich" && isVeDichStealWindow) {
        if (rq.target_player_id && rq.target_player_id === playerRow.id) {
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
      .select("id, meta, target_player_id, order_index")
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

    const alreadyConfirmed = slots.some((rq) =>
      Boolean((rq as unknown as { question_set_item_id?: unknown }).question_set_item_id)
    );
    if (alreadyConfirmed) {
      return { error: `Ghế ${seat} đã chốt gói Về đích rồi.` };
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
    for (const r of usedRows ?? []) {
      const id =
        (r as unknown as { question_set_item_id?: string | null }).question_set_item_id ?? null;
      if (id) used.add(id);
    }

    const pickOne = (candidates: PoolItem[]): PoolItem | null => {
      const eligible = candidates.filter((it) => !used.has(it.id));
      if (eligible.length === 0) return null;
      const chosen = eligible[Math.floor(Math.random() * eligible.length)] ?? null;
      if (!chosen) return null;
      used.add(chosen.id);
      return chosen;
    };

    const values = parsed.data.values as VeDichPackageValue[];
    const chosenItems: PoolItem[] = [];
    for (const v of values) {
      const item = pickOne(v === 20 ? normalizedPool20 : normalizedPool30);
      if (!item) {
        return {
          error:
            v === 20
              ? "Hết câu trong pool VD-20 (hoặc đã bị trùng)."
              : "Hết câu trong pool VD-30 (hoặc đã bị trùng).",
        };
      }
      chosenItems.push(item);
    }

    const updates = slots.map((rq, idx) => {
      const meta = (rq as unknown as { meta?: unknown }).meta;
      const metaObj = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
      const item = chosenItems[idx];
      const nextMeta = { ...metaObj, ve_dich_value: values[idx], code: item.code };
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

    revalidatePath(`/olympia/admin/matches/${parsed.data.matchId}/host`);
    revalidatePath("/olympia/client");
    if (session.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
      revalidatePath(`/olympia/client/guest/${session.join_code}`);
    }
    const summary = values.join("-");
    return { success: `Đã chốt gói Về đích ${summary} cho Ghế ${seat} (3 câu).` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể chọn gói Về đích." };
  }
}

export async function selectVeDichPackageFormAction(formData: FormData): Promise<void> {
  await selectVeDichPackageAction({}, formData);
}

export async function confirmDecisionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const startedAt = Date.now();
    let afterSessionFetchAt: number | null = null;
    let afterScoreWriteAt: number | null = null;

    const { supabase, appUserId } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = decisionSchema.safeParse({
      sessionId: formData.get("sessionId"),
      playerId: formData.get("playerId"),
      decision: formData.get("decision"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin chấm điểm." };
    }

    const { sessionId, playerId, decision } = parsed.data;
    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, match_id, join_code, current_round_type, current_round_question_id")
      .eq("id", sessionId)
      .maybeSingle();

    afterSessionFetchAt = Date.now();

    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };

    const roundType = session.current_round_type ?? "khoi_dong";

    if (roundType === "tang_toc") {
      return {
        error: "Vòng Tăng tốc chấm điểm theo thứ tự thời gian (dùng chức năng chấm tự động).",
      };
    }

    // Để chấm đúng luật theo vòng, cần biết target_player_id (thi riêng) và một số meta.
    let currentTargetPlayerId: string | null = null;
    let currentVeDichValue: 20 | 30 | null = null;
    if (session.current_round_question_id) {
      const { data: rqRow, error: rqErr } = await olympia
        .from("round_questions")
        .select("id, target_player_id, meta")
        .eq("id", session.current_round_question_id)
        .maybeSingle();
      if (rqErr) return { error: rqErr.message };
      currentTargetPlayerId = (rqRow?.target_player_id as string | null) ?? null;

      if (roundType === "khoi_dong" && !currentTargetPlayerId) {
        const info = parseKhoiDongCodeInfoFromMeta((rqRow as unknown as { meta?: unknown })?.meta);
        if (info?.kind === "personal") {
          const { data: seatPlayer, error: seatErr } = await olympia
            .from("match_players")
            .select("id")
            .eq("match_id", session.match_id)
            .eq("seat_index", info.seat)
            .maybeSingle();
          if (seatErr) return { error: seatErr.message };
          if (!seatPlayer?.id) {
            return { error: `Không tìm thấy thí sinh ghế ${info.seat}.` };
          }
          currentTargetPlayerId = seatPlayer.id;
        }
      }

      if (roundType === "ve_dich") {
        const meta = (rqRow as unknown as { meta?: unknown })?.meta;
        if (meta && typeof meta === "object") {
          const raw = (meta as Record<string, unknown>).ve_dich_value;
          const value = typeof raw === "number" ? raw : raw ? Number(raw) : NaN;
          currentVeDichValue = value === 20 || value === 30 ? value : null;
        }
      }

      // Enforce: vòng Khởi động thi chung chỉ chấm cho người bấm chuông thắng.
      // (Nếu suy luận ra thi riêng theo KD{seat}-, currentTargetPlayerId đã được gán ở trên.)
      if (roundType === "khoi_dong" && !currentTargetPlayerId) {
        const { data: buzzWinner, error: buzzErr } = await olympia
          .from("buzzer_events")
          .select("player_id, result")
          .eq("round_question_id", session.current_round_question_id)
          .eq("event_type", "buzz")
          .eq("result", "win")
          .order("occurred_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (buzzErr) return { error: buzzErr.message };
        if (!buzzWinner?.player_id) {
          return { error: "Chưa có thí sinh bấm chuông thắng để chấm." };
        }
        if (buzzWinner.player_id !== playerId) {
          return { error: "Chỉ được chấm cho thí sinh bấm chuông thắng." };
        }
      }

      // Enforce: vòng Khởi động thi riêng chỉ chấm cho đúng thí sinh được chọn.
      if (
        roundType === "khoi_dong" &&
        currentTargetPlayerId &&
        currentTargetPlayerId !== playerId
      ) {
        return { error: "Đây là lượt cá nhân, chỉ được chấm cho thí sinh đang thi." };
      }

      // Enforce chung: nếu câu đang lock target_player_id (do bấm chuông giành quyền / thi riêng)
      // thì chỉ được chấm cho đúng thí sinh đó.
      // (VCNV có cơ chế riêng, không áp dụng rule này ở đây.)
      if (roundType !== "vcnv" && currentTargetPlayerId && currentTargetPlayerId !== playerId) {
        return { error: "Chỉ được chấm cho thí sinh đang giành quyền trả lời." };
      }

      // Enforce: vòng Về đích chỉ chấm cho thí sinh chính.
      if (roundType === "ve_dich") {
        if (!currentTargetPlayerId) {
          return { error: "Vòng Về đích cần chọn thí sinh chính trước khi chấm." };
        }
        if (currentTargetPlayerId !== playerId) {
          return { error: "Vòng Về đích: chỉ được chấm cho thí sinh chính." };
        }
      }
    }
    const { data: scoreRow, error: scoreError } = await olympia
      .from("match_scores")
      .select("id, points")
      .eq("match_id", session.match_id)
      .eq("player_id", playerId)
      .eq("round_type", roundType)
      .maybeSingle();

    if (scoreError) return { error: scoreError.message };

    const currentPoints = scoreRow?.points ?? 0;

    let delta = 0;
    let nextPoints = currentPoints;

    if (roundType === "khoi_dong") {
      // Khởi động:
      // - Thi riêng (có target_player_id hoặc suy luận theo KD{seat}-): đúng +10, sai/hết giờ 0.
      // - Thi chung (target null): đúng +10, sai/hết giờ -5, clamp 0.
      if (currentTargetPlayerId) {
        delta = decision === "correct" ? 10 : 0;
        nextPoints = currentPoints + delta;
      } else {
        const computed = computeKhoiDongCommonScore(decision, currentPoints);
        delta = computed.delta;
        nextPoints = computed.nextPoints;
      }
    } else if (roundType === "vcnv") {
      // Vượt chướng ngại vật:
      // - Trả lời đúng: +10
      // - Sai/Hết giờ: 0
      delta = decision === "correct" ? 10 : 0;
      nextPoints = currentPoints + delta;
    } else if (roundType === "ve_dich") {
      // Về đích:
      // - Đúng: +20/+30 (nhân 2 nếu dùng Sao)
      // - Sai/Hết giờ: 0, nhưng nếu dùng Sao thì bị trừ đúng số điểm tương ứng.
      if (!currentVeDichValue) {
        return { error: "Không xác định được giá trị câu Về đích (20/30)." };
      }

      const { data: starRow, error: starErr } = await olympia
        .from("star_uses")
        .select("id")
        .eq("match_id", session.match_id)
        .eq("round_question_id", session.current_round_question_id)
        .eq("player_id", playerId)
        .maybeSingle();
      if (starErr) return { error: starErr.message };

      const starEnabled = Boolean(starRow?.id);
      if (decision === "correct") {
        delta = currentVeDichValue * (starEnabled ? 2 : 1);
      } else {
        delta = starEnabled ? -currentVeDichValue : 0;
      }
      nextPoints = currentPoints + delta;
    } else {
      // Mặc định: không áp luật tính điểm nếu chưa có quy tắc rõ.
      // Tránh cộng/trừ nhầm ở các vòng/loại khác.
      delta = 0;
      nextPoints = currentPoints;
    }

    // Không cho điểm âm.
    nextPoints = Math.max(0, nextPoints);
    const appliedDelta = nextPoints - currentPoints;

    if (scoreRow?.id) {
      const { error: updateScoreError } = await olympia
        .from("match_scores")
        .update({ points: nextPoints, updated_at: new Date().toISOString() })
        .eq("id", scoreRow.id);
      if (updateScoreError) return { error: updateScoreError.message };
    } else {
      const { error: insertScoreError } = await olympia.from("match_scores").insert({
        match_id: session.match_id,
        player_id: playerId,
        round_type: roundType,
        points: nextPoints,
      });
      if (insertScoreError) return { error: insertScoreError.message };
    }

    afterScoreWriteAt = Date.now();

    // Cập nhật đáp án mới nhất (nếu có) để lưu điểm và trạng thái đúng/sai.
    let answerId: string | null = null;
    if (session.current_round_question_id) {
      const { data: latestAnswer, error: answerError } = await olympia
        .from("answers")
        .select("id")
        .eq("match_id", session.match_id)
        .eq("player_id", playerId)
        .eq("round_question_id", session.current_round_question_id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (answerError) return { error: answerError.message };
      if (latestAnswer?.id) {
        answerId = latestAnswer.id;
        const { error: updateAnswerError } = await olympia
          .from("answers")
          .update({
            is_correct: decision === "correct",
            points_awarded: appliedDelta,
          })
          .eq("id", latestAnswer.id);
        if (updateAnswerError) return { error: updateAnswerError.message };
      }
    }

    const { error: auditErr } = await insertScoreChange({
      olympia,
      matchId: session.match_id,
      playerId,
      roundType,
      requestedDelta: delta,
      appliedDelta,
      pointsBefore: currentPoints,
      pointsAfter: nextPoints,
      source: "decision_confirmed",
      createdBy: appUserId ?? null,
      roundQuestionId: session.current_round_question_id ?? null,
      answerId,
    });
    if (auditErr) {
      console.warn("[Olympia] insertScoreChange(confirmDecision) failed:", auditErr);
    }

    // Host sync qua realtime/event; tránh revalidate host để giảm latency.

    console.info("[Olympia][Perf] confirmDecisionAction", {
      matchId: session.match_id,
      sessionId,
      playerId,
      decision,
      roundType,
      msTotal: Date.now() - startedAt,
      msFetchSession: afterSessionFetchAt ? afterSessionFetchAt - startedAt : null,
      msAfterScoreWrite: afterScoreWriteAt ? afterScoreWriteAt - startedAt : null,
    });

    return { success: `Đã xác nhận: ${decision}. Điểm mới: ${nextPoints}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể xác nhận kết quả." };
  }
}

// Wrapper dùng trực tiếp cho <form action={...}> trong Server Component.
// Next.js form action chỉ truyền 1 tham số (FormData).
export async function confirmDecisionFormAction(formData: FormData): Promise<ActionState> {
  return await confirmDecisionAction({}, formData);
}

// Dùng cho <form action={...}> khi không cần nhận ActionState trả về.
// Tránh tạo inline action trong Server Component (dễ bị coi là function thường).
export async function confirmDecisionVoidFormAction(formData: FormData): Promise<void> {
  await confirmDecisionAction({}, formData);
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
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin điều khiển media." };
    }

    const { matchId, mediaType, command } = parsed.data;

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

export async function confirmDecisionAndAdvanceAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const parsed = decisionAndAdvanceSchema.safeParse({
      sessionId: formData.get("sessionId"),
      playerId: formData.get("playerId"),
      decision: formData.get("decision"),
      matchId: formData.get("matchId"),
      durationMs: formData.get("durationMs") ? Number(formData.get("durationMs")) : undefined,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin chấm & chuyển câu." };
    }

    // 1) Chấm điểm
    const scoreResult = await confirmDecisionAction({}, formData);
    if (scoreResult?.error) return scoreResult;

    // 2) Chuyển câu tiếp theo và autoShow để host/clients thấy ngay.
    const fd = new FormData();
    fd.set("matchId", parsed.data.matchId);
    fd.set("direction", "next");
    if (typeof parsed.data.durationMs === "number" && Number.isFinite(parsed.data.durationMs)) {
      fd.set("durationMs", String(parsed.data.durationMs));
    }
    fd.set("autoShow", "1");

    const advanceResult = await advanceCurrentQuestionAction({}, fd);
    if (advanceResult?.error) {
      // Nếu chấm được nhưng chuyển câu lỗi, vẫn trả success chấm + báo lỗi chuyển.
      return {
        success: scoreResult?.success ?? "Đã xác nhận kết quả.",
        error: advanceResult.error,
      };
    }

    return { success: scoreResult?.success ?? advanceResult?.success ?? "Đã chấm & chuyển câu." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể chấm & chuyển câu." };
  }
}

export async function confirmDecisionAndAdvanceFormAction(formData: FormData): Promise<void> {
  await confirmDecisionAndAdvanceAction({}, formData);
}

export async function setCurrentQuestionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const startedAt = Date.now();
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
        nextQuestion = (await fetchNextByOrder(currentOrderIndex)) ?? (await fetchLastQuestion());
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

      const currentIsPersonal = Boolean(
        currentRow?.target_player_id || currentInfo?.kind === "personal"
      );
      const nextIsPersonal = Boolean(nextRow?.target_player_id || nextInfo?.kind === "personal");

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

      // Nếu đang ở thi riêng và sang câu không cùng thí sinh (hoặc sang thi chung), ép bật màn chờ.
      // Áp dụng cả khi autoShow=1 (chấm & chuyển) theo đúng luật/UX yêu cầu.
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
    return {
      success: shouldAutoShow ? "Đã chuyển & hiển thị câu mới." : "Đã chuyển câu & bật màn chờ.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể chuyển câu hỏi." };
  }
}

export async function advanceCurrentQuestionFormAction(formData: FormData): Promise<void> {
  await advanceCurrentQuestionAction({}, formData);
}

async function insertScoreChange(params: {
  olympia: unknown;
  matchId: string;
  playerId: string;
  roundType: string;
  requestedDelta: number;
  appliedDelta: number;
  pointsBefore: number;
  pointsAfter: number;
  source: string;
  reason?: string | null;
  createdBy?: string | null;
  roundQuestionId?: string | null;
  answerId?: string | null;
  revertOf?: string | null;
}): Promise<{ error?: string }> {
  const db = params.olympia as { from: (table: string) => unknown };
  type DbError = { message: string } | null;
  type InsertBuilder = {
    insert: (payload: Record<string, unknown>) => Promise<{ error: DbError }>;
  };

  try {
    const q = db.from("score_changes") as unknown as InsertBuilder;
    const { error } = await q.insert({
      match_id: params.matchId,
      player_id: params.playerId,
      round_type: params.roundType,
      requested_delta: Math.trunc(params.requestedDelta),
      applied_delta: Math.trunc(params.appliedDelta),
      points_before: Math.trunc(params.pointsBefore),
      points_after: Math.trunc(params.pointsAfter),
      source: params.source,
      reason: params.reason ?? null,
      created_by: params.createdBy ?? null,
      round_question_id: params.roundQuestionId ?? null,
      answer_id: params.answerId ?? null,
      revert_of: params.revertOf ?? null,
    });

    if (error) {
      // Không chặn luồng chấm điểm nếu DB chưa migrate bảng audit.
      if (
        /score_changes/i.test(error.message) &&
        /(does not exist|relation)/i.test(error.message)
      ) {
        return {};
      }
      return { error: error.message };
    }

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể ghi audit score_changes." };
  }
}

async function applyRoundDelta(params: {
  olympia: unknown;
  matchId: string;
  playerId: string;
  roundType: string;
  delta: number;
}): Promise<{
  nextPoints: number;
  pointsBefore: number;
  pointsAfter: number;
  appliedDelta: number;
  error?: string;
}> {
  const { olympia, matchId, playerId, roundType, delta } = params;
  const db = olympia as {
    from: (table: string) => unknown;
  };

  type DbError = { message: string } | null;
  type ScoreRow = { id: string; points: number | null };
  type ScoreSelectBuilder = {
    eq: (col: string, val: unknown) => ScoreSelectBuilder;
    maybeSingle: () => Promise<{ data: ScoreRow | null; error: DbError }>;
  };
  type ScoreUpdateBuilder = {
    eq: (col: string, val: unknown) => Promise<{ error: DbError }>;
  };
  type ScoreUpdateQuery = {
    update: (payload: Record<string, unknown>) => ScoreUpdateBuilder;
  };
  type ScoreInsertQuery = {
    insert: (payload: Record<string, unknown>) => Promise<{ error: DbError }>;
  };

  const scoreQuery = db.from("match_scores") as unknown as {
    select: (cols: string) => ScoreSelectBuilder;
  };

  const { data: scoreRow, error: scoreError } = await scoreQuery
    .select("id, points")
    .eq("match_id", matchId)
    .eq("player_id", playerId)
    .eq("round_type", roundType)
    .maybeSingle();

  if (scoreError) {
    return {
      nextPoints: 0,
      pointsBefore: 0,
      pointsAfter: 0,
      appliedDelta: 0,
      error: scoreError.message,
    };
  }
  const currentPoints = scoreRow?.points ?? 0;
  const nextPoints = Math.max(0, currentPoints + delta);
  const appliedDelta = nextPoints - currentPoints;

  if (scoreRow?.id) {
    const updateQuery = db.from("match_scores") as unknown as ScoreUpdateQuery;
    const { error: updateError } = await updateQuery
      .update({ points: nextPoints, updated_at: new Date().toISOString() })
      .eq("id", scoreRow.id);
    if (updateError) {
      return {
        nextPoints: 0,
        pointsBefore: 0,
        pointsAfter: 0,
        appliedDelta: 0,
        error: updateError.message,
      };
    }
  } else {
    const insertQuery = db.from("match_scores") as unknown as ScoreInsertQuery;
    const { error: insertError } = await insertQuery.insert({
      match_id: matchId,
      player_id: playerId,
      round_type: roundType,
      points: nextPoints,
    });
    if (insertError) {
      return {
        nextPoints: 0,
        pointsBefore: 0,
        pointsAfter: 0,
        appliedDelta: 0,
        error: insertError.message,
      };
    }
  }

  return {
    nextPoints,
    pointsBefore: currentPoints,
    pointsAfter: nextPoints,
    appliedDelta,
  };
}

const manualAdjustScoreSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  playerId: z.string().uuid("ID thí sinh không hợp lệ."),
  roundType: z.string().min(1, "Thiếu vòng điểm."),
  delta: z
    .number({ message: "Delta không hợp lệ." })
    .int("Delta phải là số nguyên.")
    .min(-500, "Delta quá nhỏ.")
    .max(500, "Delta quá lớn."),
  reason: z.string().min(3, "Cần lý do điều chỉnh (tối thiểu 3 ký tự)."),
});

export async function manualAdjustScoreAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = manualAdjustScoreSchema.safeParse({
      matchId: formData.get("matchId"),
      playerId: formData.get("playerId"),
      roundType: formData.get("roundType"),
      delta: Number(formData.get("delta")),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin điều chỉnh điểm." };
    }

    const { matchId, playerId, roundType, delta, reason } = parsed.data;
    const {
      nextPoints,
      pointsBefore,
      pointsAfter,
      appliedDelta,
      error: scoreErr,
    } = await applyRoundDelta({ olympia, matchId, playerId, roundType, delta });
    if (scoreErr) return { error: scoreErr };

    const { error: auditErr } = await insertScoreChange({
      olympia,
      matchId,
      playerId,
      roundType,
      requestedDelta: delta,
      appliedDelta,
      pointsBefore,
      pointsAfter,
      source: "manual_adjust",
      reason,
      createdBy: appUserId ?? null,
    });
    if (auditErr) {
      console.warn("[Olympia] insertScoreChange failed:", auditErr);
    }

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    return {
      success: `Đã điều chỉnh điểm (${appliedDelta >= 0 ? "+" : ""}${appliedDelta}). Điểm mới: ${nextPoints}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể điều chỉnh điểm." };
  }
}

export async function manualAdjustScoreFormAction(formData: FormData): Promise<void> {
  await manualAdjustScoreAction({}, formData);
}

const undoLastScoreChangeSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  reason: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
});

export async function undoLastScoreChangeAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase, appUserId } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = undoLastScoreChangeSchema.safeParse({
      matchId: formData.get("matchId"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin undo." };
    }

    const { data: last, error: lastErr } = await olympia
      .from("score_changes")
      .select(
        "id, match_id, player_id, round_type, requested_delta, applied_delta, points_before, points_after, round_question_id, answer_id, revert_of, reverted_at"
      )
      .eq("match_id", parsed.data.matchId)
      .is("reverted_at", null)
      .is("revert_of", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      if (
        /score_changes/i.test(lastErr.message) &&
        /(does not exist|relation)/i.test(lastErr.message)
      ) {
        return { error: "Chưa có bảng audit score_changes trong DB (cần chạy migration)." };
      }
      return { error: lastErr.message };
    }
    if (!last) return { error: "Chưa có thay đổi điểm nào để Undo." };

    const revertDelta = -Number((last as { applied_delta?: number | null }).applied_delta ?? 0);
    const {
      nextPoints,
      pointsBefore,
      pointsAfter,
      appliedDelta,
      error: scoreErr,
    } = await applyRoundDelta({
      olympia,
      matchId: (last as { match_id: string }).match_id,
      playerId: (last as { player_id: string }).player_id,
      roundType: (last as { round_type: string }).round_type,
      delta: revertDelta,
    });
    if (scoreErr) return { error: scoreErr };

    const { error: markErr } = await olympia
      .from("score_changes")
      .update({ reverted_at: new Date().toISOString(), reverted_by: appUserId ?? null })
      .eq("id", (last as { id: string }).id);
    if (markErr) return { error: markErr.message };

    const { error: auditErr } = await insertScoreChange({
      olympia,
      matchId: (last as { match_id: string }).match_id,
      playerId: (last as { player_id: string }).player_id,
      roundType: (last as { round_type: string }).round_type,
      requestedDelta: revertDelta,
      appliedDelta,
      pointsBefore,
      pointsAfter,
      source: "undo",
      reason: parsed.data.reason,
      createdBy: appUserId ?? null,
      roundQuestionId: (last as { round_question_id?: string | null }).round_question_id ?? null,
      answerId: (last as { answer_id?: string | null }).answer_id ?? null,
      revertOf: (last as { id: string }).id,
    });
    if (auditErr) {
      console.warn("[Olympia] insertScoreChange(undo) failed:", auditErr);
    }

    // Best-effort: nếu có answer_id thì reset points_awarded về 0 để host chấm lại.
    const answerId = (last as { answer_id?: string | null }).answer_id;
    if (answerId) {
      const { error: answerResetErr } = await olympia
        .from("answers")
        .update({ points_awarded: 0 })
        .eq("id", answerId);
      if (answerResetErr) {
        console.warn("[Olympia] undo reset answer points_awarded failed:", answerResetErr.message);
      }
    }

    revalidatePath(`/olympia/admin/matches/${parsed.data.matchId}/host`);
    return { success: `Đã Undo thay đổi gần nhất. Điểm mới: ${nextPoints}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể Undo." };
  }
}

export async function undoLastScoreChangeFormAction(formData: FormData): Promise<void> {
  await undoLastScoreChangeAction({}, formData);
}

export async function submitObstacleGuessAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  void formData;
  // Theo yêu cầu UX: đoán CNV là trả lời miệng; thí sinh chỉ bấm chuông xin quyền.
  // Host sẽ nhập từ khóa và xác nhận đúng/sai.
  return { error: "CNV: chỉ đoán miệng. Hãy bấm chuông để xin quyền đoán." };
}

export async function submitObstacleGuessByHostFormAction(formData: FormData): Promise<void> {
  try {
    const { supabase } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = obstacleGuessHostSubmitSchema.safeParse({
      sessionId: formData.get("sessionId"),
      playerId: formData.get("playerId"),
      guessText: formData.get("guessText"),
    });
    if (!parsed.success) {
      console.warn("[Olympia] submitObstacleGuessByHostFormAction invalid payload");
      return;
    }

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select(
        "id, status, match_id, join_code, current_round_id, current_round_type, current_round_question_id"
      )
      .eq("id", parsed.data.sessionId)
      .maybeSingle();
    if (sessionError || !session) {
      console.warn(
        "[Olympia] submitObstacleGuessByHostFormAction session lookup failed",
        sessionError?.message
      );
      return;
    }
    if (session.status !== "running") return;
    if (!session.match_id || !session.current_round_id) return;
    if (session.current_round_type !== "vcnv") return;

    // Lấy round_question cuối cùng của vòng VCNV (là ô trung tâm hoặc OTT)
    // để insert answer vào đó (không dùng obstacle_guesses nữa)
    const { data: rqRow, error: rqError } = await olympia
      .from("round_questions")
      .select("id, match_round_id")
      .eq("match_round_id", session.current_round_id)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (rqError || !rqRow) {
      console.warn(
        "[Olympia] submitObstacleGuessByHostFormAction round_question lookup failed",
        rqError?.message
      );
      return;
    }

    // Insert guess trực tiếp vào answers table
    const { error: insertError } = await olympia.from("answers").insert({
      match_id: session.match_id,
      match_round_id: rqRow.match_round_id,
      round_question_id: rqRow.id,
      player_id: parsed.data.playerId,
      answer_text: parsed.data.guessText,
      is_correct: false,
      response_time_ms: null,
      submitted_at: new Date().toISOString(),
    });
    if (insertError) {
      console.warn(
        "[Olympia] submitObstacleGuessByHostFormAction insert failed",
        insertError.message
      );
      return;
    }

    revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);
    if (session.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
      revalidatePath(`/olympia/client/guest/${session.join_code}`);
      revalidatePath(`/olympia/client/mc/${session.join_code}`);
    }
  } catch (err) {
    console.warn("[Olympia] submitObstacleGuessByHostFormAction failed", err);
  }
}

export async function confirmVcnvRowDecisionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase, appUserId } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = vcnvRowDecisionSchema.safeParse({
      sessionId: formData.get("sessionId"),
      playerId: formData.get("playerId"),
      decision: formData.get("decision"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin chấm CNV." };
    }

    const { sessionId, playerId, decision } = parsed.data;
    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select(
        "id, match_id, join_code, current_round_type, current_round_id, current_round_question_id"
      )
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };
    if (session.current_round_type !== "vcnv") return { error: "Hiện không ở vòng CNV." };
    if (!session.current_round_question_id) return { error: "Chưa có câu hỏi CNV đang hiển thị." };

    // Nếu thí sinh bấm chuông xin trả lời (winner) mà bị chấm SAI => mất quyền thi vòng VCNV.
    // Chỉ áp dụng cho người thắng buzzer của câu CNV hiện tại (không áp dụng cho các đáp án nhập máy thông thường).
    if (decision === "wrong") {
      const rqId = session.current_round_question_id;

      const { data: lastReset, error: resetErr } = await olympia
        .from("buzzer_events")
        .select("occurred_at")
        .eq("match_id", session.match_id)
        .eq("round_question_id", rqId)
        .eq("event_type", "reset")
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (resetErr) return { error: resetErr.message };
      const resetOccurredAt =
        ((lastReset as { occurred_at?: string | null } | null) ?? null)?.occurred_at ?? null;

      let winnerQuery = olympia
        .from("buzzer_events")
        .select("id")
        .eq("match_id", session.match_id)
        .eq("round_question_id", rqId)
        .eq("event_type", "buzz")
        .eq("result", "win")
        .eq("player_id", playerId);
      if (resetOccurredAt) winnerQuery = winnerQuery.gte("occurred_at", resetOccurredAt);

      const { data: winner, error: winnerErr } = await winnerQuery
        .order("occurred_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (winnerErr) return { error: winnerErr.message };

      if (winner?.id) {
        const { error: dqErr } = await olympia
          .from("match_players")
          .update({ is_disqualified_obstacle: true })
          .eq("id", playerId);
        if (dqErr) return { error: dqErr.message };
      }
    }

    const delta = decision === "correct" ? 10 : 0;
    const {
      nextPoints,
      pointsBefore,
      pointsAfter,
      appliedDelta,
      error: scoreErr,
    } = await applyRoundDelta({
      olympia,
      matchId: session.match_id,
      playerId,
      roundType: "vcnv",
      delta,
    });
    if (scoreErr) return { error: scoreErr };

    const { data: latestAnswer, error: answerError } = await olympia
      .from("answers")
      .select("id")
      .eq("match_id", session.match_id)
      .eq("player_id", playerId)
      .eq("round_question_id", session.current_round_question_id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (answerError) return { error: answerError.message };

    let resolvedAnswerId: string | null = latestAnswer?.id ?? null;

    // Nếu chưa có answer (thí sinh không nhập máy), vẫn tạo placeholder để:
    // - UI host thấy trạng thái đã chấm
    // - logic khóa/mở ô CNV hoạt động đúng khi "không ai đúng"
    if (!resolvedAnswerId) {
      const { data: rqRow, error: rqError } = await olympia
        .from("round_questions")
        .select("id, match_round_id")
        .eq("id", session.current_round_question_id)
        .maybeSingle();
      if (rqError) return { error: rqError.message };
      if (!rqRow?.id || !(rqRow as { match_round_id?: string | null }).match_round_id) {
        return { error: "Không xác định được round_question để tạo placeholder." };
      }

      const submittedAt = new Date().toISOString();
      const { data: inserted, error: insertAnsErr } = await olympia
        .from("answers")
        .insert({
          match_id: session.match_id,
          match_round_id: (rqRow as { match_round_id: string }).match_round_id,
          round_question_id: rqRow.id,
          player_id: playerId,
          answer_text: null,
          response_time_ms: null,
          submitted_at: submittedAt,
          is_correct: decision === "correct",
          points_awarded: delta,
        })
        .select("id");
      if (insertAnsErr) return { error: insertAnsErr.message };

      const insertedRow = Array.isArray(inserted)
        ? ((inserted[0] as { id?: string } | undefined) ?? null)
        : ((inserted as { id?: string } | null) ?? null);
      resolvedAnswerId = insertedRow?.id ?? null;
    }

    if (resolvedAnswerId) {
      const { error: updateAnswerError } = await olympia
        .from("answers")
        .update({
          is_correct: decision === "correct",
          points_awarded: delta,
        })
        .eq("id", resolvedAnswerId);
      if (updateAnswerError) return { error: updateAnswerError.message };
    }

    // Trả lời hàng ngang đúng: state sẽ được tính từ answers (vcnvRevealByRoundQuestionId)
    // Không cần update obstacle_tiles, answers table là source-of-truth

    const { error: auditErr } = await insertScoreChange({
      olympia,
      matchId: session.match_id,
      playerId,
      roundType: "vcnv",
      requestedDelta: delta,
      appliedDelta,
      pointsBefore,
      pointsAfter,
      source: "vcnv_row_confirm",
      createdBy: appUserId ?? null,
      roundQuestionId: session.current_round_question_id,
      answerId: resolvedAnswerId,
    });
    if (auditErr) {
      console.warn("[Olympia] insertScoreChange(vcnv row) failed:", auditErr);
    }

    revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);
    if (session.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
      revalidatePath(`/olympia/client/guest/${session.join_code}`);
    }

    return { success: `Đã chấm CNV: ${decision}. Điểm vòng CNV hiện tại: ${nextPoints}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể chấm CNV." };
  }
}

export async function confirmVcnvRowDecisionFormAction(formData: FormData): Promise<void> {
  await confirmVcnvRowDecisionAction({}, formData);
}

export async function confirmObstacleGuessAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase, appUserId } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = obstacleGuessConfirmSchema.safeParse({
      answerId: formData.get("answerId"),
      decision: formData.get("decision"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin xác nhận CNV." };
    }

    // Lấy answer từ bảng answers (không dùng obstacle_guesses)
    const { data: answer, error: answerError } = await olympia
      .from("answers")
      .select("id, match_id, player_id, is_correct")
      .eq("id", parsed.data.answerId)
      .maybeSingle();
    if (answerError) return { error: answerError.message };
    if (!answer) return { error: "Không tìm thấy lượt đoán." };

    const matchId = answer.match_id;

    if (parsed.data.decision === "wrong") {
      const { error: updateAnswerError } = await olympia
        .from("answers")
        .update({ is_correct: false })
        .eq("id", answer.id);
      if (updateAnswerError) return { error: updateAnswerError.message };

      const { error: dqError } = await olympia
        .from("match_players")
        .update({ is_disqualified_obstacle: true })
        .eq("id", answer.player_id);
      if (dqError) return { error: dqError.message };

      revalidatePath(`/olympia/admin/matches/${matchId}/host`);
      return { success: "Đã xác nhận SAI và loại quyền đoán CNV cho thí sinh." };
    }

    if (answer.is_correct) {
      revalidatePath(`/olympia/admin/matches/${matchId}/host`);
      return { success: "Lượt đoán này đã được xác nhận đúng trước đó." };
    }

    const { error: updateAnswerError } = await olympia
      .from("answers")
      .update({ is_correct: true })
      .eq("id", answer.id);
    if (updateAnswerError) return { error: updateAnswerError.message };

    // Tính điểm dựa trên số hàng VCNV được trả lời đúng (từ answers table)
    // Lấy tất cả round_questions của vòng VCNV từ match hiện tại
    const { data: currentRound, error: roundError } = await olympia
      .from("live_sessions")
      .select("current_round_id")
      .eq("match_id", matchId)
      .maybeSingle();
    if (roundError) return { error: roundError.message };
    if (!currentRound?.current_round_id) return { error: "Không xác định vòng VCNV." };

    // === REVEAL ALL: Tạo answers cho tất cả hàng VCNV chưa mở ===
    // Lấy tất cả round_questions của vòng VCNV với meta.code để xác định loại ô
    const { data: allRqForRound, error: rqFetchErr } = await olympia
      .from("round_questions")
      .select("id, meta, match_round_id")
      .eq("match_round_id", currentRound.current_round_id);
    if (rqFetchErr) {
      console.warn("[Olympia] fetch round_questions for reveal-all failed:", rqFetchErr.message);
    } else if (allRqForRound && allRqForRound.length > 0) {
      // Xác định các hàng VCNV (VCNV-1, VCNV-2, VCNV-3, VCNV-4, OTT, VCNV-OTT)
      const vcnvCodeToId = new Map<string, string>();
      const wantedCodes = new Set(["VCNV-1", "VCNV-2", "VCNV-3", "VCNV-4", "OTT", "VCNV-OTT"]);

      for (const rq of allRqForRound as Array<{
        id: string;
        meta?: unknown;
        match_round_id: string;
      }>) {
        let code: string | null = null;
        if (rq.meta && typeof rq.meta === "object") {
          const raw = (rq.meta as Record<string, unknown>).code;
          code = typeof raw === "string" ? raw.trim().toUpperCase() : null;
        }
        if (code && wantedCodes.has(code) && !vcnvCodeToId.has(code)) {
          vcnvCodeToId.set(code, rq.id);
        }
      }

      // Lấy danh sách hàng nào đã có answer (với is_correct != null)
      const vcnvRqIds = Array.from(vcnvCodeToId.values());
      if (vcnvRqIds.length > 0) {
        const { data: existingAnswers, error: existingErr } = await olympia
          .from("answers")
          .select("round_question_id")
          .eq("match_id", matchId)
          .in("round_question_id", vcnvRqIds)
          .not("is_correct", "is", null);
        if (existingErr) {
          console.warn("[Olympia] fetch existing VCNV answers failed:", existingErr.message);
        } else {
          const answeredRqIds = new Set(
            (existingAnswers as Array<{ round_question_id: string }> | null)?.map(
              (a) => a.round_question_id
            ) ?? []
          );

          // Tạo answers cho hàng chưa mở
          const toCreate: Array<{
            match_id: string;
            match_round_id: string;
            round_question_id: string;
            player_id: string;
            is_correct: boolean;
          }> = [];

          for (const [, rqId] of vcnvCodeToId) {
            if (!answeredRqIds.has(rqId)) {
              toCreate.push({
                match_id: matchId,
                match_round_id: currentRound.current_round_id,
                round_question_id: rqId,
                player_id: answer.player_id,
                is_correct: true,
              });
            }
          }

          if (toCreate.length > 0) {
            const { error: insertErr } = await olympia.from("answers").insert(toCreate);
            if (insertErr) {
              console.warn("[Olympia] reveal-all insert answers failed:", insertErr.message);
            }
          }
        }
      }
    }

    const { data: vcnvQuestions, error: vcnvQError } = await olympia
      .from("round_questions")
      .select("id")
      .eq("match_round_id", currentRound.current_round_id);
    if (vcnvQError) return { error: vcnvQError.message };

    const vcnvIds = vcnvQuestions?.map((q: { id: string }) => q.id) ?? [];
    const { count: openedCount, error: openedError } = await olympia
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("match_id", matchId)
      .eq("is_correct", true)
      .in("round_question_id", vcnvIds);
    if (openedError) return { error: openedError.message };

    const delta = computeVcnvFinalScore(openedCount ?? 0);
    const {
      nextPoints,
      pointsBefore,
      pointsAfter,
      appliedDelta,
      error: scoreErr,
    } = await applyRoundDelta({
      olympia,
      matchId,
      playerId: answer.player_id,
      roundType: "vcnv",
      delta,
    });
    if (scoreErr) return { error: scoreErr };

    const { error: auditErr } = await insertScoreChange({
      olympia,
      matchId,
      playerId: answer.player_id,
      roundType: "vcnv",
      requestedDelta: delta,
      appliedDelta,
      pointsBefore,
      pointsAfter,
      source: "vcnv_final_confirm",
      createdBy: appUserId ?? null,
    });
    if (auditErr) {
      console.warn("[Olympia] insertScoreChange(vcnv final) failed:", auditErr);
    }

    // Không update obstacle_tiles, answers table là source-of-truth
    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("join_code")
      .eq("match_id", matchId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    if (session?.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
      revalidatePath(`/olympia/client/guest/${session.join_code}`);
    }

    return {
      success: `Đã xác nhận ĐÚNG. Cộng ${delta} điểm (CNV). Điểm vòng CNV hiện tại: ${nextPoints}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể xác nhận CNV." };
  }
}

export async function confirmObstacleGuessFormAction(formData: FormData): Promise<void> {
  await confirmObstacleGuessAction({}, formData);
}

export async function markAnswerCorrectnessAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = markAnswerCorrectnessSchema.safeParse({
      answerId: formData.get("answerId"),
      decision: formData.get("decision"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin đánh dấu đáp án." };
    }

    const { data: answerRow, error: answerError } = await olympia
      .from("answers")
      .select("id, match_id")
      .eq("id", parsed.data.answerId)
      .maybeSingle();
    if (answerError) return { error: answerError.message };
    if (!answerRow) return { error: "Không tìm thấy đáp án." };

    const { error: updateError } = await olympia
      .from("answers")
      .update({ is_correct: parsed.data.decision === "correct" })
      .eq("id", answerRow.id);
    if (updateError) return { error: updateError.message };

    revalidatePath(`/olympia/admin/matches/${answerRow.match_id}/host`);
    return { success: "Đã cập nhật trạng thái đúng/sai." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật trạng thái đáp án." };
  }
}

export async function markAnswerCorrectnessFormAction(formData: FormData): Promise<void> {
  await markAnswerCorrectnessAction({}, formData);
}

export async function autoScoreTangTocAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase, appUserId } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = autoScoreTangTocSchema.safeParse({ sessionId: formData.get("sessionId") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin chấm Tăng tốc." };
    }

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, match_id, join_code, current_round_type, current_round_question_id")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };
    if (session.current_round_type !== "tang_toc") return { error: "Hiện không ở vòng Tăng tốc." };
    if (!session.current_round_question_id) return { error: "Chưa chọn câu hỏi Tăng tốc." };

    const { data: answers, error: answersError } = await olympia
      .from("answers")
      .select("id, player_id, submitted_at, is_correct")
      .eq("match_id", session.match_id)
      .eq("round_question_id", session.current_round_question_id)
      .eq("is_correct", true)
      .order("submitted_at", { ascending: true });
    if (answersError) return { error: answersError.message };

    // De-dup theo player: lấy đáp án ĐÚNG sớm nhất mỗi người.
    const byPlayer = new Map<string, { answerId: string; submittedAtMs: number }>();
    for (const a of answers ?? []) {
      if (!a.player_id) continue;
      const submittedAtMs = a.submitted_at ? new Date(a.submitted_at).getTime() : Number.NaN;
      if (!Number.isFinite(submittedAtMs)) continue;
      if (!byPlayer.has(a.player_id)) {
        byPlayer.set(a.player_id, { answerId: a.id, submittedAtMs });
      }
    }

    const awards = computeTangTocAwards({
      submissions: Array.from(byPlayer.entries()).map(([playerId, v]) => ({
        id: playerId,
        submittedAtMs: v.submittedAtMs,
      })),
      thresholdMs: 10,
      pointsByRank: [40, 30, 20, 10],
    });

    const winners: Array<{ answerId: string; playerId: string; points: number }> = [];
    for (const [playerId, v] of byPlayer.entries()) {
      const points = awards.get(playerId);
      if (typeof points !== "number") continue;
      winners.push({ answerId: v.answerId, playerId, points });
    }

    winners.sort((a, b) => {
      const ams = byPlayer.get(a.playerId)?.submittedAtMs ?? 0;
      const bms = byPlayer.get(b.playerId)?.submittedAtMs ?? 0;
      return ams - bms;
    });

    for (const w of winners) {
      const {
        pointsBefore,
        pointsAfter,
        appliedDelta,
        error: scoreErr,
      } = await applyRoundDelta({
        olympia,
        matchId: session.match_id,
        playerId: w.playerId,
        roundType: "tang_toc",
        delta: w.points,
      });
      if (scoreErr) return { error: scoreErr };

      const { error: updateAnswerError } = await olympia
        .from("answers")
        .update({ points_awarded: w.points })
        .eq("id", w.answerId);
      if (updateAnswerError) return { error: updateAnswerError.message };

      const { error: auditErr } = await insertScoreChange({
        olympia,
        matchId: session.match_id,
        playerId: w.playerId,
        roundType: "tang_toc",
        requestedDelta: w.points,
        appliedDelta,
        pointsBefore,
        pointsAfter,
        source: "tang_toc_auto",
        createdBy: appUserId ?? null,
        roundQuestionId: session.current_round_question_id,
        answerId: w.answerId,
      });
      if (auditErr) {
        console.warn("[Olympia] insertScoreChange(tang toc) failed:", auditErr);
      }
    }

    revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);
    if (session.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
      revalidatePath(`/olympia/client/guest/${session.join_code}`);
    }

    return { success: `Đã chấm Tăng tốc (tự động) cho ${winners.length} thí sinh.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể chấm Tăng tốc." };
  }
}

export async function autoScoreTangTocFormAction(formData: FormData): Promise<void> {
  await autoScoreTangTocAction({}, formData);
}

export async function setVeDichQuestionValueAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = veDichValueSchema.safeParse({
      matchId: formData.get("matchId"),
      roundQuestionId: formData.get("roundQuestionId"),
      value: Number(formData.get("value")),
      playerId: formData.get("playerId"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin giá trị câu." };
    }

    const { data: rq, error: rqError } = await olympia
      .from("round_questions")
      .select("id, meta")
      .eq("id", parsed.data.roundQuestionId)
      .maybeSingle();
    if (rqError) return { error: rqError.message };
    if (!rq) return { error: "Không tìm thấy câu hỏi." };

    const currentMeta = (rq.meta ?? {}) as Record<string, unknown>;
    const nextMeta = {
      ...currentMeta,
      ve_dich_value: parsed.data.value,
    };

    const updatePayload: { meta: Record<string, unknown>; target_player_id?: string | null } = {
      meta: nextMeta,
    };
    if (parsed.data.playerId) updatePayload.target_player_id = parsed.data.playerId;

    const { error: updateError } = await olympia
      .from("round_questions")
      .update(updatePayload)
      .eq("id", rq.id);
    if (updateError) return { error: updateError.message };

    revalidatePath(`/olympia/admin/matches/${parsed.data.matchId}/host`);
    return { success: "Đã cập nhật giá trị câu Về đích." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật giá trị câu." };
  }
}

export async function setVeDichQuestionValueFormAction(formData: FormData): Promise<void> {
  await setVeDichQuestionValueAction({}, formData);
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
        .select("id, order_index")
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

      const updates = mine
        .slice()
        .sort((a, b) => ((a.order_index ?? 0) as number) - ((b.order_index ?? 0) as number))
        .slice(0, 3)
        .map((rq) =>
          olympia
            .from("round_questions")
            .update({ target_player_id: parsed.data.playerId, question_set_item_id: null })
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

    // Khi đổi thí sinh/thi chung-thi riêng: luôn reset câu đang live + bật màn chờ + tắt chuông.
    // Đây là hành vi yêu cầu để tránh UI giữ câu cũ khi đổi ghế/thí sinh.
    // Chỉ reset nếu phòng đang running; nếu chưa mở phòng thì skip (không báo lỗi).
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

export async function confirmDecisionsBatchAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase, appUserId } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = decisionBatchSchema.safeParse({
      sessionId: formData.get("sessionId"),
      itemsJson: formData.get("itemsJson"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin chấm batch." };
    }

    let rawItems: unknown;
    try {
      rawItems = JSON.parse(parsed.data.itemsJson);
    } catch {
      return { error: "Danh sách chấm không hợp lệ (JSON)." };
    }

    const itemsParsed = decisionBatchItemsSchema.safeParse(rawItems);
    if (!itemsParsed.success) {
      return { error: itemsParsed.error.issues[0]?.message ?? "Danh sách chấm không hợp lệ." };
    }

    const items = itemsParsed.data;
    if (items.length === 0) return { error: "Chưa có quyết định nào để chấm." };

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, match_id, join_code, current_round_type, current_round_question_id")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };

    const roundType = (session.current_round_type ?? "khoi_dong") as
      | "khoi_dong"
      | "vcnv"
      | "tang_toc"
      | "ve_dich";

    if (roundType !== "tang_toc") {
      // Batch cho các vòng khác: gọi lại confirmDecisionAction để tái dùng rule/validate.
      for (const item of items) {
        const fd = new FormData();
        fd.set("sessionId", parsed.data.sessionId);
        fd.set("playerId", item.playerId);
        fd.set("decision", item.decision);
        const res = await confirmDecisionAction({}, fd);
        if (res.error) return { error: res.error };
      }
      return { success: `Đã chấm batch ${items.length} quyết định.` };
    }

    // Tăng tốc: tính điểm theo thứ tự host chấm (đúng-only: 40/30/20/10).
    if (!session.current_round_question_id) {
      return { error: "Chưa chọn câu hỏi Tăng tốc." };
    }

    const awardByRank = [40, 30, 20, 10];
    let correctRank = 0;

    const playerIds = items.map((x) => x.playerId);

    const { data: scoreRows, error: scoreErr } = await olympia
      .from("match_scores")
      .select("id, player_id, points")
      .eq("match_id", session.match_id)
      .eq("round_type", "tang_toc")
      .in("player_id", playerIds);
    if (scoreErr) return { error: scoreErr.message };

    const currentPointsByPlayerId = new Map<string, { id: string | null; points: number }>();
    for (const pid of playerIds) {
      currentPointsByPlayerId.set(pid, { id: null, points: 0 });
    }
    for (const row of scoreRows ?? []) {
      const r = row as unknown as { id: string; player_id: string; points: number | null };
      currentPointsByPlayerId.set(r.player_id, { id: r.id, points: r.points ?? 0 });
    }

    for (const item of items) {
      const prev = currentPointsByPlayerId.get(item.playerId) ?? { id: null, points: 0 };

      const requestedDelta = item.decision === "correct" ? (awardByRank[correctRank] ?? 0) : 0;
      if (item.decision === "correct") correctRank += 1;

      const nextPoints = Math.max(0, prev.points + requestedDelta);
      const appliedDelta = nextPoints - prev.points;

      if (prev.id) {
        const { error: updateScoreError } = await olympia
          .from("match_scores")
          .update({ points: nextPoints, updated_at: new Date().toISOString() })
          .eq("id", prev.id);
        if (updateScoreError) return { error: updateScoreError.message };
      } else {
        const { error: insertScoreError } = await olympia.from("match_scores").insert({
          match_id: session.match_id,
          player_id: item.playerId,
          round_type: "tang_toc",
          points: nextPoints,
        });
        if (insertScoreError) return { error: insertScoreError.message };
      }

      // Update đáp án mới nhất (nếu có) để lưu đúng/sai và điểm.
      let answerId: string | null = null;
      const { data: latestAnswer, error: answerError } = await olympia
        .from("answers")
        .select("id")
        .eq("match_id", session.match_id)
        .eq("player_id", item.playerId)
        .eq("round_question_id", session.current_round_question_id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (answerError) return { error: answerError.message };
      if (latestAnswer?.id) {
        answerId = latestAnswer.id;
        const { error: updateAnswerError } = await olympia
          .from("answers")
          .update({
            is_correct: item.decision === "correct",
            points_awarded: appliedDelta,
          })
          .eq("id", latestAnswer.id);
        if (updateAnswerError) return { error: updateAnswerError.message };
      }

      const { error: auditErr } = await insertScoreChange({
        olympia,
        matchId: session.match_id,
        playerId: item.playerId,
        roundType: "tang_toc",
        requestedDelta,
        appliedDelta,
        pointsBefore: prev.points,
        pointsAfter: nextPoints,
        source: "tang_toc_batch",
        createdBy: appUserId ?? null,
        roundQuestionId: session.current_round_question_id,
        answerId,
      });
      if (auditErr) {
        console.warn("[Olympia] insertScoreChange(confirmDecisionsBatch) failed:", auditErr);
      }

      currentPointsByPlayerId.set(item.playerId, { id: prev.id, points: nextPoints });
    }

    return { success: `Đã chấm Tăng tốc (batch) cho ${items.length} quyết định.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể chấm batch." };
  }
}

export async function confirmDecisionsBatchFormAction(formData: FormData): Promise<void> {
  await confirmDecisionsBatchAction({}, formData);
}

export async function toggleStarUseAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = toggleStarSchema.safeParse({
      matchId: formData.get("matchId"),
      roundQuestionId: formData.get("roundQuestionId"),
      playerId: formData.get("playerId"),
      enabled: formData.get("enabled"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin Star." };
    }

    if (!parsed.data.enabled) {
      const { error: delError } = await olympia
        .from("star_uses")
        .delete()
        .eq("match_id", parsed.data.matchId)
        .eq("round_question_id", parsed.data.roundQuestionId)
        .eq("player_id", parsed.data.playerId);
      if (delError) return { error: delError.message };
      return { success: "Đã tắt Star." };
    }

    const { error: upsertError } = await olympia.from("star_uses").upsert(
      {
        match_id: parsed.data.matchId,
        round_question_id: parsed.data.roundQuestionId,
        player_id: parsed.data.playerId,
        outcome: null,
        declared_at: new Date().toISOString(),
      },
      { onConflict: "round_question_id,player_id" }
    );
    if (upsertError) return { error: upsertError.message };

    return { success: "Đã bật Star." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật Star." };
  }
}

export async function toggleStarUseFormAction(formData: FormData): Promise<void> {
  await toggleStarUseAction({}, formData);
}

export async function openStealWindowAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = openStealWindowSchema.safeParse({
      matchId: formData.get("matchId"),
      durationMs: formData.get("durationMs") ? Number(formData.get("durationMs")) : undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin mở cửa cướp." };
    }

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status, current_round_type, current_round_question_id")
      .eq("match_id", parsed.data.matchId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận chưa mở phòng live." };
    if (session.status !== "running") return { error: "Phòng chưa ở trạng thái running." };
    if (session.current_round_type !== "ve_dich") return { error: "Hiện không ở vòng Về đích." };
    if (!session.current_round_question_id) return { error: "Chưa có câu hỏi Về đích đang mở." };

    const deadline = new Date(Date.now() + parsed.data.durationMs).toISOString();
    const { error: updateError } = await olympia
      .from("live_sessions")
      .update({ question_state: "answer_revealed", timer_deadline: deadline, buzzer_enabled: true })
      .eq("id", session.id);
    if (updateError) return { error: updateError.message };

    revalidatePath(`/olympia/admin/matches/${parsed.data.matchId}/host`);
    return { success: "Đã mở cửa cướp (5s)." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể mở cửa cướp." };
  }
}

export async function openStealWindowFormAction(formData: FormData): Promise<void> {
  await openStealWindowAction({}, formData);
}

async function getVeDichValueFromRoundQuestionMeta(meta: unknown): Promise<number> {
  if (!meta || typeof meta !== "object") return 20;
  const raw = (meta as Record<string, unknown>).ve_dich_value;
  const val = typeof raw === "number" ? raw : Number(raw);
  return val === 30 ? 30 : 20;
}

export async function confirmVeDichMainDecisionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase, appUserId } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = confirmVeDichMainSchema.safeParse({
      sessionId: formData.get("sessionId"),
      decision: formData.get("decision"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin chấm Về đích." };
    }

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select(
        "id, match_id, join_code, current_round_type, current_round_question_id, question_state"
      )
      .eq("id", parsed.data.sessionId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };
    if (session.current_round_type !== "ve_dich") return { error: "Hiện không ở vòng Về đích." };
    if (!session.current_round_question_id) return { error: "Chưa có câu hỏi Về đích." };

    // Nếu đang mở cửa cướp thì chấm theo luật cướp (để chấm nhanh tự chuyển sang người cướp).
    if (session.question_state === "answer_revealed") {
      return await confirmVeDichStealDecisionAction(_, formData);
    }

    const { data: rq, error: rqError } = await olympia
      .from("round_questions")
      .select("id, target_player_id, meta")
      .eq("id", session.current_round_question_id)
      .maybeSingle();
    if (rqError) return { error: rqError.message };
    if (!rq) return { error: "Không tìm thấy câu hỏi hiện tại." };
    if (!rq.target_player_id) return { error: "Chưa đặt thí sinh trả lời chính." };

    const value = await getVeDichValueFromRoundQuestionMeta(rq.meta);
    const { data: starRow } = await olympia
      .from("star_uses")
      .select("id")
      .eq("match_id", session.match_id)
      .eq("round_question_id", rq.id)
      .eq("player_id", rq.target_player_id)
      .maybeSingle();
    const starEnabled = Boolean(starRow?.id);

    const decision = parsed.data.decision;
    const isCorrect = decision === "correct";
    // Luật Về đích:
    // - Đúng: +value (nhân đôi nếu Star)
    // - Sai/Hết giờ: 0, nhưng nếu Star thì -value
    const delta = isCorrect ? value * (starEnabled ? 2 : 1) : starEnabled ? -value : 0;

    const {
      pointsBefore,
      pointsAfter,
      appliedDelta,
      error: scoreErr,
    } = await applyRoundDelta({
      olympia,
      matchId: session.match_id,
      playerId: rq.target_player_id,
      roundType: "ve_dich",
      delta,
    });
    if (scoreErr) return { error: scoreErr };

    if (starEnabled) {
      const { error: starUpdateError } = await olympia
        .from("star_uses")
        .update({ outcome: isCorrect ? "applied" : "wasted" })
        .eq("match_id", session.match_id)
        .eq("round_question_id", rq.id)
        .eq("player_id", rq.target_player_id);
      if (starUpdateError) return { error: starUpdateError.message };
    }

    const { data: latestAnswer } = await olympia
      .from("answers")
      .select("id")
      .eq("match_id", session.match_id)
      .eq("player_id", rq.target_player_id)
      .eq("round_question_id", rq.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestAnswer?.id) {
      const { error: updateAnswerError } = await olympia
        .from("answers")
        .update({ is_correct: isCorrect, points_awarded: appliedDelta })
        .eq("id", latestAnswer.id);
      if (updateAnswerError) return { error: updateAnswerError.message };
    }

    const { error: auditErr } = await insertScoreChange({
      olympia,
      matchId: session.match_id,
      playerId: rq.target_player_id,
      roundType: "ve_dich",
      requestedDelta: delta,
      appliedDelta,
      pointsBefore,
      pointsAfter,
      source: "ve_dich_main_confirm",
      createdBy: appUserId ?? null,
      roundQuestionId: rq.id,
      answerId: latestAnswer?.id ?? null,
    });
    if (auditErr) {
      console.warn("[Olympia] insertScoreChange(ve dich main) failed:", auditErr);
    }

    if (isCorrect) {
      // Về đích: KHÔNG auto chuyển câu.
      // Chấm xong thì quay lại màn chờ (hidden) để chuẩn bị câu tiếp theo.
      const { error: completeErr } = await olympia
        .from("live_sessions")
        .update({
          question_state: "hidden",
          current_round_question_id: null,
          timer_deadline: null,
          buzzer_enabled: false,
        })
        .eq("id", session.id);
      if (completeErr) return { error: completeErr.message };
    } else {
      // Sai/Hết giờ → mở cửa cướp 5s
      const stealDeadline = new Date(Date.now() + 5000).toISOString();
      const { error: stealWindowErr } = await olympia
        .from("live_sessions")
        .update({
          question_state: "answer_revealed",
          timer_deadline: stealDeadline,
          buzzer_enabled: true,
        })
        .eq("id", session.id);
      if (stealWindowErr) return { error: stealWindowErr.message };
    }

    revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);
    if (session.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
      revalidatePath(`/olympia/client/guest/${session.join_code}`);
    }

    return {
      success: isCorrect
        ? `Đã chấm ĐÚNG (+${appliedDelta}).`
        : starEnabled
          ? `Đã chấm SAI/HẾT GIỜ (${appliedDelta}) và mở cửa cướp (5s).`
          : "Đã chấm SAI/HẾT GIỜ (0) và mở cửa cướp (5s).",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể chấm Về đích." };
  }
}

export async function confirmVeDichMainDecisionFormAction(formData: FormData): Promise<void> {
  await confirmVeDichMainDecisionAction({}, formData);
}

export async function confirmVeDichStealDecisionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase, appUserId } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = confirmVeDichStealSchema.safeParse({
      sessionId: formData.get("sessionId"),
      decision: formData.get("decision"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin chấm cướp." };
    }

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, match_id, join_code, current_round_type, current_round_question_id")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };
    if (session.current_round_type !== "ve_dich") return { error: "Hiện không ở vòng Về đích." };
    if (!session.current_round_question_id) return { error: "Chưa có câu hỏi Về đích." };

    const { data: rq, error: rqError } = await olympia
      .from("round_questions")
      .select("id, meta, target_player_id")
      .eq("id", session.current_round_question_id)
      .maybeSingle();
    if (rqError) return { error: rqError.message };
    if (!rq) return { error: "Không tìm thấy câu hỏi hiện tại." };

    const { data: stealWinner, error: stealError } = await olympia
      .from("buzzer_events")
      .select("player_id")
      .eq("round_question_id", rq.id)
      .eq("event_type", "steal")
      .eq("result", "win")
      .order("occurred_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (stealError) return { error: stealError.message };
    if (!stealWinner?.player_id) return { error: "Chưa có người giành quyền cướp." };

    const value = await getVeDichValueFromRoundQuestionMeta(rq.meta);
    const decision = parsed.data.decision;
    const isCorrect = decision === "correct";
    const penalty = value / 2;

    // Luật cướp điểm:
    // - Đúng: lấy điểm từ quỹ điểm của thí sinh đang thi (chuyển từ thí sinh chính sang người cướp)
    // - Sai/Hết giờ: người cướp bị trừ 50% điểm câu
    if (isCorrect) {
      if (!rq.target_player_id) return { error: "Chưa có thí sinh chính để trừ quỹ điểm." };

      const gain = await applyRoundDelta({
        olympia,
        matchId: session.match_id,
        playerId: stealWinner.player_id,
        roundType: "ve_dich",
        delta: value,
      });
      if (gain.error) return { error: gain.error };

      const loss = await applyRoundDelta({
        olympia,
        matchId: session.match_id,
        playerId: rq.target_player_id,
        roundType: "ve_dich",
        delta: -value,
      });
      if (loss.error) return { error: loss.error };

      const { data: latestAnswer } = await olympia
        .from("answers")
        .select("id")
        .eq("match_id", session.match_id)
        .eq("player_id", stealWinner.player_id)
        .eq("round_question_id", rq.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestAnswer?.id) {
        const { error: updateAnswerError } = await olympia
          .from("answers")
          .update({ is_correct: true, points_awarded: gain.appliedDelta })
          .eq("id", latestAnswer.id);
        if (updateAnswerError) return { error: updateAnswerError.message };
      }

      const { error: auditGainErr } = await insertScoreChange({
        olympia,
        matchId: session.match_id,
        playerId: stealWinner.player_id,
        roundType: "ve_dich",
        requestedDelta: value,
        appliedDelta: gain.appliedDelta,
        pointsBefore: gain.pointsBefore,
        pointsAfter: gain.pointsAfter,
        source: "ve_dich_steal_confirm",
        createdBy: appUserId ?? null,
        roundQuestionId: rq.id,
        answerId: latestAnswer?.id ?? null,
      });
      if (auditGainErr) {
        console.warn("[Olympia] insertScoreChange(ve dich steal gain) failed:", auditGainErr);
      }

      const { error: auditLossErr } = await insertScoreChange({
        olympia,
        matchId: session.match_id,
        playerId: rq.target_player_id,
        roundType: "ve_dich",
        requestedDelta: -value,
        appliedDelta: loss.appliedDelta,
        pointsBefore: loss.pointsBefore,
        pointsAfter: loss.pointsAfter,
        source: "ve_dich_steal_transfer",
        createdBy: appUserId ?? null,
        roundQuestionId: rq.id,
        answerId: null,
      });
      if (auditLossErr) {
        console.warn("[Olympia] insertScoreChange(ve dich steal transfer) failed:", auditLossErr);
      }

      // Về đích: KHÔNG auto chuyển câu. Đóng cửa cướp sau khi chấm.
      const { error: completeErr } = await olympia
        .from("live_sessions")
        .update({
          question_state: "completed",
          timer_deadline: null,
          buzzer_enabled: false,
        })
        .eq("id", session.id);
      if (completeErr) return { error: completeErr.message };

      revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);
      if (session.join_code) {
        revalidatePath(`/olympia/client/game/${session.join_code}`);
        revalidatePath(`/olympia/client/guest/${session.join_code}`);
      }

      return { success: `Cướp ĐÚNG (+${value}), đã trừ ${value} từ thí sinh chính.` };
    }

    // Sai/Hết giờ (cướp)
    const lose = await applyRoundDelta({
      olympia,
      matchId: session.match_id,
      playerId: stealWinner.player_id,
      roundType: "ve_dich",
      delta: -penalty,
    });
    if (lose.error) return { error: lose.error };

    const { data: latestAnswer } = await olympia
      .from("answers")
      .select("id")
      .eq("match_id", session.match_id)
      .eq("player_id", stealWinner.player_id)
      .eq("round_question_id", rq.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestAnswer?.id) {
      const { error: updateAnswerError } = await olympia
        .from("answers")
        .update({ is_correct: false, points_awarded: lose.appliedDelta })
        .eq("id", latestAnswer.id);
      if (updateAnswerError) return { error: updateAnswerError.message };
    }

    const { error: auditErr } = await insertScoreChange({
      olympia,
      matchId: session.match_id,
      playerId: stealWinner.player_id,
      roundType: "ve_dich",
      requestedDelta: -penalty,
      appliedDelta: lose.appliedDelta,
      pointsBefore: lose.pointsBefore,
      pointsAfter: lose.pointsAfter,
      source: "ve_dich_steal_confirm",
      createdBy: appUserId ?? null,
      roundQuestionId: rq.id,
      answerId: latestAnswer?.id ?? null,
    });
    if (auditErr) {
      console.warn("[Olympia] insertScoreChange(ve dich steal) failed:", auditErr);
    }

    // Về đích: KHÔNG auto chuyển câu. Đóng cửa cướp sau khi chấm.
    const { error: completeErr } = await olympia
      .from("live_sessions")
      .update({
        question_state: "completed",
        timer_deadline: null,
        buzzer_enabled: false,
      })
      .eq("id", session.id);
    if (completeErr) return { error: completeErr.message };

    revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);
    if (session.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
      revalidatePath(`/olympia/client/guest/${session.join_code}`);
    }

    return {
      success: `Cướp SAI/HẾT GIỜ (${lose.appliedDelta}).`,
      error: null,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể chấm cướp." };
  }
}

export async function confirmVeDichStealDecisionFormAction(formData: FormData): Promise<void> {
  await confirmVeDichStealDecisionAction({}, formData);
}

const participantSchema = z.object({
  userId: z.string().uuid("User ID không hợp lệ."),
  role: z
    .enum(["contestant", "AD", "MOD"])
    .optional()
    .transform((val) => (val === "contestant" ? null : val)),
  contestantCode: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim().toUpperCase() : null)),
});

const updateParticipantSchema = z.object({
  userId: z.string().uuid("User ID không hợp lệ."),
  role: z
    .enum(["contestant", "AD", "MOD"])
    .optional()
    .transform((val) => (val === "contestant" ? null : val)),
  contestantCode: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim().toUpperCase() : null)),
});

const tournamentSchema = z.object({
  name: z.string().min(3, "Tên giải tối thiểu 3 ký tự"),
  startsAt: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val).toISOString() : null)),
  endsAt: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val).toISOString() : null)),
  status: z
    .enum(["planned", "active", "archived"])
    .optional()
    .transform((val) => val ?? "planned"),
});

export async function createParticipantAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = participantSchema.safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
      contestantCode: formData.get("contestantCode"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
    }

    const { userId, role, contestantCode } = parsed.data;

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (userError) return { error: userError.message };
    if (!user) return { error: "User ID không tồn tại trong hệ thống." };

    // Check if already exists
    const { data: existing } = await olympia
      .from("participants")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) return { error: "Tài khoản này đã được đăng ký Olympia." };

    const { error } = await olympia.from("participants").insert({
      user_id: userId,
      role: role,
      contestant_code: contestantCode,
    });

    if (error) return { error: error.message };

    revalidatePath("/olympia/admin/accounts");
    revalidatePath("/olympia/admin");
    return { success: "Đã thêm tài khoản Olympia thành công." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể tạo tài khoản." };
  }
}

export async function updateParticipantAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = updateParticipantSchema.safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
      contestantCode: formData.get("contestantCode"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
    }

    const { userId, role, contestantCode } = parsed.data;

    const { error } = await olympia
      .from("participants")
      .update({
        role: role,
        contestant_code: contestantCode,
      })
      .eq("user_id", userId);

    if (error) return { error: error.message };

    revalidatePath("/olympia/admin/accounts");
    revalidatePath("/olympia/admin");
    return { success: "Đã cập nhật tài khoản thành công." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật tài khoản." };
  }
}

export async function deleteParticipantAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const userId = formData.get("userId") as string;

    if (!userId || !userId.match(/^[0-9a-f\-]+$/i)) {
      return { error: "User ID không hợp lệ." };
    }

    const { error } = await olympia.from("participants").delete().eq("user_id", userId);

    if (error) return { error: error.message };

    revalidatePath("/olympia/admin/accounts");
    revalidatePath("/olympia/admin");
    return { success: "Đã xóa tài khoản thành công." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể xóa tài khoản." };
  }
}

export async function createTournamentAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = tournamentSchema.safeParse({
      name: formData.get("name"),
      startsAt: formData.get("startsAt"),
      endsAt: formData.get("endsAt"),
      status: formData.get("status"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
    }

    const { name, startsAt, endsAt, status } = parsed.data;

    const { error } = await olympia.from("tournaments").insert({
      name: name,
      starts_at: startsAt,
      ends_at: endsAt,
      status: status,
    });

    if (error) return { error: error.message };

    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    return { success: "Đã tạo giải đấu mới." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể tạo giải đấu." };
  }
}

export async function updateTournamentAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = z
      .object({
        tournamentId: z.string().uuid("ID giải không hợp lệ."),
        name: z.string().min(3, "Tên giải tối thiểu 3 ký tự"),
        startsAt: z
          .string()
          .optional()
          .transform((val) => (val ? new Date(val).toISOString() : null)),
        endsAt: z
          .string()
          .optional()
          .transform((val) => (val ? new Date(val).toISOString() : null)),
        status: z.enum(["planned", "active", "archived"]).optional(),
      })
      .safeParse({
        tournamentId: formData.get("tournamentId"),
        name: formData.get("name"),
        startsAt: formData.get("startsAt"),
        endsAt: formData.get("endsAt"),
        status: formData.get("status"),
      });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
    }

    const { tournamentId, name, startsAt, endsAt, status } = parsed.data;

    const { error } = await olympia
      .from("tournaments")
      .update({
        name: name,
        starts_at: startsAt,
        ends_at: endsAt,
        status: status,
      })
      .eq("id", tournamentId);

    if (error) return { error: error.message };

    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    return { success: "Đã cập nhật giải đấu thành công." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật giải đấu." };
  }
}

export async function updateMatchAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = z
      .object({
        matchId: z.string().uuid("ID trận không hợp lệ."),
        name: z.string().min(3, "Tên trận tối thiểu 3 ký tự"),
        tournamentId: z
          .string()
          .uuid("ID giải không hợp lệ.")
          .optional()
          .or(z.literal(""))
          .transform((val) => (val ? val : null)),
        scheduledAt: z
          .string()
          .optional()
          .transform((val) => (val ? new Date(val).toISOString() : null)),
        status: z.enum(["draft", "scheduled", "live", "finished", "cancelled"]).optional(),
      })
      .safeParse({
        matchId: formData.get("matchId"),
        name: formData.get("name"),
        tournamentId: formData.get("tournamentId"),
        scheduledAt: formData.get("scheduledAt"),
        status: formData.get("status"),
      });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
    }

    const { matchId, name, tournamentId, scheduledAt, status } = parsed.data;

    const { error } = await olympia
      .from("matches")
      .update({
        name: name,
        tournament_id: tournamentId,
        scheduled_at: scheduledAt,
        status: status,
      })
      .eq("id", matchId);

    if (error) return { error: error.message };

    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    return { success: "Đã cập nhật trận thành công." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật trận." };
  }
}

/**
 * Generate round_questions from question_set_items based on code prefix.
 * Partitions items into 4 rounds (khoi_dong, vcnv, tang_toc, ve_dich).
 */
type GenerateRoundQuestionsDebug = {
  matchId: string;
  questionSetIdsCount: number;
  roundsCount: number;
  roundTypes: string[];
  itemsFetched: number;
  itemsRecognized: number;
  itemsUnrecognized: number;
  recognizedByRound: Record<string, number>;
  insertedTotal: number;
  insertErrors: Array<{ roundType: string; message: string }>;
  notes: string[];
};

async function generateRoundQuestionsFromSetsAction(
  matchId: string,
  questionSetIds: string[]
): Promise<GenerateRoundQuestionsDebug> {
  const debug: GenerateRoundQuestionsDebug = {
    matchId,
    questionSetIdsCount: questionSetIds.length,
    roundsCount: 0,
    roundTypes: [],
    itemsFetched: 0,
    itemsRecognized: 0,
    itemsUnrecognized: 0,
    recognizedByRound: {},
    insertedTotal: 0,
    insertErrors: [],
    notes: [],
  };

  try {
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    if (questionSetIds.length === 0) {
      debug.notes.push("Không có questionSetIds được chọn.");
      console.warn("[Olympia] generateRoundQuestionsFromSets: empty questionSetIds", { matchId });
      return debug;
    }

    // Fetch all match_rounds for this match
    const { data: roundsData, error: roundsError } = await olympia
      .from("match_rounds")
      .select("id, round_type")
      .eq("match_id", matchId);
    if (roundsError) throw roundsError;

    debug.roundsCount = roundsData?.length ?? 0;
    debug.roundTypes = (roundsData ?? []).map((r) => r.round_type);

    if (!roundsData || roundsData.length === 0) {
      debug.notes.push("Chưa có match_rounds cho trận (chưa tạo vòng).");
      console.warn("[Olympia] generateRoundQuestionsFromSets: no match_rounds", { matchId });
      return debug;
    }

    const roundMap = new Map(roundsData.map((r) => [r.round_type, r.id]));

    // Fetch all question_set_items from the selected sets
    const { data: itemsData, error: itemsError } = await olympia
      .from("question_set_items")
      .select("id, code, question_text, answer_text, note, order_index")
      .in("question_set_id", questionSetIds)
      .order("order_index", { ascending: true });
    if (itemsError) throw itemsError;

    debug.itemsFetched = itemsData?.length ?? 0;

    if (!itemsData || itemsData.length === 0) {
      debug.notes.push("Không có question_set_items trong các bộ đề đã chọn.");
      console.warn("[Olympia] generateRoundQuestionsFromSets: no items", {
        matchId,
        questionSetIdsCount: questionSetIds.length,
      });
      return debug;
    }

    // Clear existing round_questions for this match
    const { error: deleteError } = await olympia
      .from("round_questions")
      .delete()
      .in("match_round_id", Array.from(roundMap.values()));
    if (deleteError) throw deleteError;

    // Partition items by round_type (based on code prefix)
    const roundPartitions = new Map<string, typeof itemsData>();
    let unrecognized = 0;
    for (const item of itemsData) {
      const roundType = parseQuestionRoundType(item.code);
      if (!roundType) {
        unrecognized += 1;
        continue;
      }
      if (!roundPartitions.has(roundType)) {
        roundPartitions.set(roundType, []);
      }
      roundPartitions.get(roundType)!.push(item);
    }

    debug.itemsUnrecognized = unrecognized;
    debug.itemsRecognized = debug.itemsFetched - unrecognized;
    debug.recognizedByRound = Object.fromEntries(
      Array.from(roundPartitions.entries()).map(([roundType, items]) => [roundType, items.length])
    );

    if (debug.itemsRecognized === 0) {
      debug.notes.push(
        "Không nhận diện được mã câu. Code cần bắt đầu bằng KD/DKA/VCNV(CNV)/TT/VD (không phân biệt hoa/thường)."
      );
      console.warn("[Olympia] generateRoundQuestionsFromSets: all codes unrecognized", {
        matchId,
        itemsFetched: debug.itemsFetched,
      });
      return debug;
    }

    // Insert round_questions for each round
    for (const [roundType, items] of roundPartitions.entries()) {
      const roundId = roundMap.get(roundType);
      if (!roundId) {
        debug.notes.push(
          `Không có match_rounds.round_type='${roundType}' nên bỏ qua ${items.length} câu.`
        );
        continue;
      }

      const roundQuestionsPayload = items.map((item, idx) => ({
        match_round_id: roundId,
        question_set_item_id: item.id,
        order_index: idx,
        question_text: item.question_text,
        answer_text: item.answer_text,
        note: item.note,
        target_player_id: null,
        meta: item.code ? { code: item.code } : {},
      }));

      const { error: insertError } = await olympia
        .from("round_questions")
        .insert(roundQuestionsPayload);
      if (insertError) {
        debug.insertErrors.push({ roundType, message: insertError.message });
        console.warn("[Olympia] Failed to insert round_questions:", {
          matchId,
          roundType,
          message: insertError.message,
        });
      } else {
        debug.insertedTotal += roundQuestionsPayload.length;
      }
    }

    console.info("[Olympia] generateRoundQuestionsFromSets summary:", debug);
    return debug;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debug.notes.push(`Lỗi khi generate round_questions: ${message}`);
    console.error("[Olympia] generateRoundQuestionsFromSets error:", err);
    return debug;
  }
}

const updateMatchQuestionSetsSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  questionSetIds: z.array(z.string().uuid("Bộ đề không hợp lệ.")).default([]),
});

export async function updateMatchQuestionSetsAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const rawSetIds = formData
      .getAll("questionSetIds")
      .filter((value): value is string => typeof value === "string");
    const parsed = updateMatchQuestionSetsSchema.safeParse({
      matchId: formData.get("matchId"),
      questionSetIds: rawSetIds,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu gán bộ đề không hợp lệ." };
    }

    const matchId = parsed.data.matchId;
    const uniqueSetIds = Array.from(new Set(parsed.data.questionSetIds));

    if (uniqueSetIds.length > 0) {
      const { data: validSets, error: validateError } = await olympia
        .from("question_sets")
        .select("id")
        .in("id", uniqueSetIds);

      if (validateError) return { error: validateError.message };
      const validSetIds = (validSets ?? []).map((set) => set.id);
      const missing = uniqueSetIds.filter((id) => !validSetIds.includes(id));
      if (missing.length > 0) {
        return { error: "Tồn tại bộ đề không hợp lệ hoặc đã bị xóa." };
      }
    }

    const { error: deleteError } = await olympia
      .from("match_question_sets")
      .delete()
      .eq("match_id", matchId);
    if (deleteError) return { error: deleteError.message };

    if (uniqueSetIds.length > 0) {
      const payload = uniqueSetIds.map((setId) => ({ match_id: matchId, question_set_id: setId }));
      const { error: insertError } = await olympia.from("match_question_sets").insert(payload);
      if (insertError) return { error: insertError.message };
    }

    // Auto-generate round_questions from question_set_items
    const genDebug = await generateRoundQuestionsFromSetsAction(matchId, uniqueSetIds);

    revalidatePath(`/olympia/admin/matches/${matchId}`);
    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");

    const debugParts = [
      `rounds=${genDebug.roundsCount}`,
      `items=${genDebug.itemsFetched}`,
      `recognized=${genDebug.itemsRecognized}`,
      `inserted=${genDebug.insertedTotal}`,
      genDebug.insertErrors.length > 0 ? `errors=${genDebug.insertErrors.length}` : null,
    ].filter((v): v is string => Boolean(v));

    const noteText = genDebug.notes.length > 0 ? ` Ghi chú: ${genDebug.notes.join(" | ")}` : "";
    const debugText = debugParts.length > 0 ? ` (debug: ${debugParts.join(", ")}).` : ".";
    return { success: `Đã cập nhật bộ đề cho trận.${debugText}${noteText}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể gán bộ đề cho trận." };
  }
}

const updateMatchPlayersOrderSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  playerOrder: z.array(
    z.object({
      playerId: z.string().uuid("Thí sinh không hợp lệ."),
      seatIndex: z.number().int().min(1).max(4),
    })
  ),
});

export async function updateMatchPlayersOrderAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const rawPlayerOrder = formData.getAll("playerOrder[]");
    const playerOrderData = rawPlayerOrder
      .filter((item): item is string => typeof item === "string")
      .map((item) => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      })
      .filter((item) => item !== null);

    const parsed = updateMatchPlayersOrderSchema.safeParse({
      matchId: formData.get("matchId"),
      playerOrder: playerOrderData,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu sắp xếp thí sinh không hợp lệ." };
    }

    const { matchId, playerOrder } = parsed.data;

    // Verify match exists
    const { data: match, error: matchError } = await olympia
      .from("matches")
      .select("id")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) return { error: matchError.message };
    if (!match) return { error: "Không tìm thấy trận." };

    // Update each player's seat_index
    const updatePromises = playerOrder.map((player) =>
      olympia
        .from("match_players")
        .update({ seat_index: player.seatIndex })
        .eq("id", player.playerId)
        .eq("match_id", matchId)
    );

    const results = await Promise.all(updatePromises);
    const hasError = results.some((r) => r.error);
    if (hasError) {
      const firstError = results.find((r) => r.error)?.error;
      return { error: firstError?.message || "Không thể cập nhật thứ tự thí sinh." };
    }

    revalidatePath(`/olympia/admin/matches/${matchId}`);
    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");

    return { success: "Đã cập nhật thứ tự thí sinh thành công." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật thứ tự thí sinh." };
  }
}

const createMatchRoundsSchema = z.object({
  matchId: z.string().uuid("Mã trận không hợp lệ."),
});

export async function createMatchRoundsAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = createMatchRoundsSchema.safeParse({ matchId: formData.get("matchId") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin trận." };
    }

    const matchId = parsed.data.matchId;

    // Check if match exists
    const { data: match, error: matchError } = await olympia
      .from("matches")
      .select("id")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) return { error: matchError.message };
    if (!match) return { error: "Không tìm thấy trận." };

    // Check if rounds already exist
    const { data: existingRounds, error: checkError } = await olympia
      .from("match_rounds")
      .select("id")
      .eq("match_id", matchId);
    if (checkError) return { error: checkError.message };

    if (existingRounds && existingRounds.length > 0) {
      return { error: "Trận này đã có các vòng thi." };
    }

    // Create default rounds
    const roundTypes = [
      { roundType: "khoi_dong", orderIndex: 0 },
      { roundType: "vcnv", orderIndex: 1 },
      { roundType: "tang_toc", orderIndex: 2 },
      { roundType: "ve_dich", orderIndex: 3 },
    ];

    const { error: insertError } = await olympia.from("match_rounds").insert(
      roundTypes.map((round) => ({
        match_id: matchId,
        round_type: round.roundType,
        order_index: round.orderIndex,
        config: {},
      }))
    );

    if (insertError) return { error: insertError.message };

    revalidatePath(`/olympia/admin/matches/${matchId}`);
    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    return { success: "Đã tạo 4 vòng thi mặc định (Khởi động, Vượt chướng, Tăng tốc, Về đích)." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể tạo vòng thi." };
  }
}
