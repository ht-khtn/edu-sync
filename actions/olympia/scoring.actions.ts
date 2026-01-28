"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";
import { getServerAuthContext } from "@/lib/server-auth";
import {
  computeKhoiDongCommonScore,
  computeTangTocAwards,
  computeVcnvFinalScore,
} from "@/lib/olympia-scoring";
import { getVeDichStealTimingMs } from "@/lib/olympia/olympia-config";
import {
  estimateFormDataPayloadBytes,
  getOrCreateTraceId,
  readStringFormField,
  traceInfo,
} from "@/lib/olympia/olympia-trace";
import { requireOlympiaAdminContext } from "@/lib/olympia/olympia-auth";
import type { ActionState } from "./match.actions";
import { advanceCurrentQuestionAction } from "./realtime.actions";

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

const manualEditScoreSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  playerId: z.string().uuid("ID thí sinh không hợp lệ."),
  newTotal: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : Number.parseInt(String(v), 10)))
    .refine((n) => Number.isFinite(n), "Điểm không hợp lệ.")
    .transform((n) => Math.trunc(n)),
});

const resetMatchScoresSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
});

const resetLiveSessionSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
});

const decisionSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  playerId: z.string().uuid("Thí sinh không hợp lệ."),
  decision: z.enum(["correct", "wrong", "timeout"]),
});

const decisionAndAdvanceSchema = decisionSchema.extend({
  matchId: z.string().uuid("Trận không hợp lệ."),
  // durationMs theo luật từng vòng (vòng 1: 5s, vòng 4: 15/20s). Nếu thiếu sẽ dùng default của advance.
  durationMs: z.number().int().min(1000).max(120000).optional(),
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

const confirmVeDichMainSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  decision: z.enum(["correct", "wrong", "timeout"]),
});

const confirmVeDichStealSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  decision: z.enum(["correct", "wrong", "timeout"]),
});

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

const undoLastScoreChangeSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  reason: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
});

async function getVeDichValueFromRoundQuestionMeta(meta: unknown): Promise<number> {
  if (!meta || typeof meta !== "object") return 20;
  const raw = (meta as Record<string, unknown>).ve_dich_value;
  const val = typeof raw === "number" ? raw : Number(raw);
  return val === 30 ? 30 : 20;
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

    // Support editing multiple players in one submission.
    const playerIds = formData
      .getAll("playerId")
      .map((v) => String(v))
      .filter(Boolean);
    const newTotalsRaw = formData.getAll("newTotal");

    if (playerIds.length === 0) {
      return { error: "Thiếu thông tin chỉnh điểm." };
    }

    const now = new Date().toISOString();
    let anyChanged = false;
    const summaries: string[] = [];

    for (let i = 0; i < playerIds.length; i++) {
      const pId = playerIds[i];
      const rawNew = newTotalsRaw[i] ?? newTotalsRaw[0] ?? null;

      const parsedOne = manualEditScoreSchema.safeParse({
        matchId: formData.get("matchId"),
        playerId: pId,
        newTotal: rawNew,
      });

      if (!parsedOne.success) {
        return { error: parsedOne.error.issues[0]?.message ?? "Dữ liệu chỉnh điểm không hợp lệ." };
      }

      const { matchId, playerId, newTotal } = parsedOne.data;

      const { data: rows, error: rowsErr } = await olympia
        .from("match_scores")
        .select("id, round_type, points")
        .eq("match_id", matchId)
        .eq("player_id", playerId);

      if (rowsErr) return { error: rowsErr.message };

      const pointsBefore = (rows ?? []).reduce((acc, r) => acc + (r.points ?? 0), 0);
      const delta = newTotal - pointsBefore;

      if (delta === 0) {
        summaries.push(`${playerId}: không đổi`);
        continue;
      }

      anyChanged = true;

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

      summaries.push(`${pointsBefore} → ${pointsAfter}`);
    }

    if (!anyChanged) {
      return { success: "Không có thay đổi điểm nào." };
    }

    // Revalidate once for UI update
    revalidatePath(`/olympia/admin/matches/${String(formData.get("matchId") ?? "")}/host`);
    revalidatePath(`/olympia/admin/matches/${String(formData.get("matchId") ?? "")}`);

    return { success: `Đã chỉnh điểm: ${summaries.join(", ")}` };
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

    const { error: delRealtimeErr } = await olympia
      .from("realtime_events")
      .delete()
      .eq("match_id", matchId);
    if (delRealtimeErr) return { error: delRealtimeErr.message };

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

export async function confirmDecisionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const startedAt = Date.now();
    const traceId = getOrCreateTraceId(formData);
    traceInfo({
      traceId,
      action: "confirmDecisionAction",
      event: "start",
      fields: {
        sessionId: readStringFormField(formData, "sessionId"),
        playerId: readStringFormField(formData, "playerId"),
        decision: readStringFormField(formData, "decision"),
        payloadBytes: estimateFormDataPayloadBytes(formData),
      },
    });
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
      .select(
        "id, match_id, join_code, current_round_id, current_round_type, current_round_question_id"
      )
      .eq("id", sessionId)
      .maybeSingle();

    traceInfo({
      traceId,
      action: "confirmDecisionAction",
      event: "db.live_sessions",
      fields: { msSinceStart: Date.now() - startedAt },
    });

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
    let isKhoiDongCommonRound: boolean = false;
    let currentVeDichValue: 20 | 30 | null = null;
    let currentMatchRoundId = session.current_round_id ?? null;
    if (session.current_round_question_id) {
      const { data: rqRow, error: rqErr } = await olympia
        .from("round_questions")
        .select("id, target_player_id, meta, match_round_id")
        .eq("id", session.current_round_question_id)
        .maybeSingle();
      if (rqErr) return { error: rqErr.message };
      currentTargetPlayerId = (rqRow?.target_player_id as string | null) ?? null;
      currentMatchRoundId = rqRow?.match_round_id ?? currentMatchRoundId;

      traceInfo({
        traceId,
        action: "confirmDecisionAction",
        event: "db.round_questions",
        fields: { msSinceStart: Date.now() - startedAt },
      });

      // Xác định loại câu Khởi động dựa trên code (DKA- = thi chung, KD{N}- = thi riêng)
      let khoiDongCodeInfo: ReturnType<typeof parseKhoiDongCodeInfoFromMeta> | null = null;
      if (roundType === "khoi_dong") {
        khoiDongCodeInfo = parseKhoiDongCodeInfoFromMeta(
          (rqRow as unknown as { meta?: unknown })?.meta
        );
      }

      // Nếu code chỉ ra thi riêng (KD{N}-), lấy thí sinh theo ghế
      if (roundType === "khoi_dong" && khoiDongCodeInfo?.kind === "personal") {
        const { data: seatPlayer, error: seatErr } = await olympia
          .from("match_players")
          .select("id")
          .eq("match_id", session.match_id)
          .eq("seat_index", khoiDongCodeInfo.seat)
          .maybeSingle();
        if (seatErr) return { error: seatErr.message };
        if (!seatPlayer?.id) {
          return { error: `Không tìm thấy thí sinh ghế ${khoiDongCodeInfo.seat}.` };
        }
        currentTargetPlayerId = seatPlayer.id;
      }

      // Xác định: nếu code là DKA- (thi chung) thì đánh dấu isKhoiDongCommonRound
      if (roundType === "khoi_dong" && khoiDongCodeInfo?.kind === "common") {
        isKhoiDongCommonRound = true;
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
      if (isKhoiDongCommonRound) {
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

    traceInfo({
      traceId,
      action: "confirmDecisionAction",
      event: "db.match_scores.select",
      fields: { msSinceStart: Date.now() - startedAt },
    });

    if (scoreError) return { error: scoreError.message };

    const currentPoints = scoreRow?.points ?? 0;

    let delta = 0;
    let nextPoints = currentPoints;

    if (roundType === "khoi_dong") {
      // Khởi động:
      // - Thi riêng (có target_player_id hoặc suy luận theo KD{seat}-): đúng +10, sai/hết giờ 0.
      // - Thi chung (target null, không phải code riêng): đúng +10, sai/hết giờ -5, clamp 0.
      if (isKhoiDongCommonRound) {
        const computed = computeKhoiDongCommonScore(decision, currentPoints);
        delta = computed.delta;
        nextPoints = computed.nextPoints;
      } else if (currentTargetPlayerId) {
        delta = decision === "correct" ? 10 : 0;
        nextPoints = currentPoints + delta;
      } else {
        // Fallback: nếu không phải thi chung và không có target, cũng không trừ điểm
        delta = decision === "correct" ? 10 : 0;
        nextPoints = currentPoints + delta;
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

    traceInfo({
      traceId,
      action: "confirmDecisionAction",
      event: "db.match_scores.upsert",
      fields: { msSinceStart: Date.now() - startedAt, appliedDelta },
    });

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
      } else {
        if (!currentMatchRoundId) {
          return { error: "Không xác định được vòng thi để ghi đáp án." };
        }
        const { data: insertedAnswer, error: insertAnswerError } = await olympia
          .from("answers")
          .insert({
            match_id: session.match_id,
            match_round_id: currentMatchRoundId,
            round_question_id: session.current_round_question_id,
            player_id: playerId,
            answer_text: null,
            is_correct: decision === "correct",
            points_awarded: appliedDelta,
          })
          .select("id")
          .maybeSingle();
        if (insertAnswerError) return { error: insertAnswerError.message };
        answerId = insertedAnswer?.id ?? null;
      }
    }

    traceInfo({
      traceId,
      action: "confirmDecisionAction",
      event: "db.answers.update_latest",
      fields: { msSinceStart: Date.now() - startedAt },
    });

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

    traceInfo({
      traceId,
      action: "confirmDecisionAction",
      event: "end",
      fields: { msTotal: Date.now() - startedAt, matchId: session.match_id, nextPoints },
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

export async function confirmDecisionAndAdvanceAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const traceId = getOrCreateTraceId(formData);
    traceInfo({
      traceId,
      action: "confirmDecisionAndAdvanceAction",
      event: "start",
      fields: {
        sessionId: readStringFormField(formData, "sessionId"),
        playerId: readStringFormField(formData, "playerId"),
        matchId: readStringFormField(formData, "matchId"),
        decision: readStringFormField(formData, "decision"),
        payloadBytes: estimateFormDataPayloadBytes(formData),
      },
    });
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
    fd.set("traceId", traceId);
    fd.set("direction", "next");
    if (typeof parsed.data.durationMs === "number" && Number.isFinite(parsed.data.durationMs)) {
      fd.set("durationMs", String(parsed.data.durationMs));
    }
    fd.set("autoShow", "1");

    // Thêm một khoảng delay rất nhỏ để giảm khả năng race-condition giữa
    // bản ghi chấm điểm và sự kiện realtime/host optimistic update.
    // Delay này không ảnh hưởng tới logic luật (không thay đổi điều kiện
    // chuyển câu hoặc màn chờ của Khởi động thi riêng) nhưng giúp tránh
    // trường hợp UI host nhảy sang câu mới rồi bị event khác đè ngay lập tức.
    await new Promise((res) => setTimeout(res, 80));

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
      .select("id, match_id, player_id, is_correct, submitted_at")
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

    // Tính điểm CNV theo số hàng ngang đã qua tại thời điểm thí sinh đoán.
    // Lưu ý: không dựa trên is_correct=true vì:
    // - có thể "reveal-all" để mở hình sau khi giải CNV
    // - CNV/OTT cũng có thể tạo answers riêng
    // Luật: 60 - 10 * (số hàng ngang đã qua)
    const { data: currentRound, error: roundError } = await olympia
      .from("live_sessions")
      .select("current_round_id")
      .eq("match_id", matchId)
      .maybeSingle();
    if (roundError) return { error: roundError.message };
    if (!currentRound?.current_round_id) return { error: "Không xác định vòng VCNV." };

    const guessSubmittedAt =
      (answer as { submitted_at?: string | null } | null)?.submitted_at ?? null;
    if (!guessSubmittedAt) {
      return { error: "Không xác định được thời điểm đoán CNV." };
    }

    // === REVEAL ALL: Tạo answers cho tất cả hàng VCNV chưa mở ===
    // Lấy tất cả round_questions của vòng VCNV với meta.code để xác định loại ô
    const { data: allRqForRound, error: rqFetchErr } = await olympia
      .from("round_questions")
      .select("id, meta, match_round_id")
      .eq("match_round_id", currentRound.current_round_id);
    if (rqFetchErr) {
      console.warn("[Olympia] fetch round_questions for reveal-all failed:", rqFetchErr.message);
    } else if (allRqForRound && allRqForRound.length > 0) {
      // Xác định các hàng VCNV (VCNV-1..4) và các ô đặc biệt (OTT/VCNV-OTT)
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

      // === 1) Tính số hàng ngang đã qua tại thời điểm đoán ===
      const horizontalIds = [
        vcnvCodeToId.get("VCNV-1"),
        vcnvCodeToId.get("VCNV-2"),
        vcnvCodeToId.get("VCNV-3"),
        vcnvCodeToId.get("VCNV-4"),
      ].filter((id): id is string => typeof id === "string" && id.length > 0);

      let passedHorizontalsCount = 0;
      if (horizontalIds.length > 0) {
        const { data: decided, error: decidedErr } = await olympia
          .from("answers")
          .select("round_question_id")
          .eq("match_id", matchId)
          .in("round_question_id", horizontalIds)
          .not("is_correct", "is", null)
          .lte("submitted_at", guessSubmittedAt);
        if (decidedErr) {
          console.warn("[Olympia] fetch decided horizontals failed:", decidedErr.message);
        } else {
          const decidedIds = new Set(
            (decided as Array<{ round_question_id: string }> | null)?.map(
              (a) => a.round_question_id
            ) ?? []
          );
          passedHorizontalsCount = decidedIds.size;
        }
      }

      // Tính điểm CNV theo luật 60 - 10 * số hàng ngang đã qua.
      // (Sau khi đã mở 4 hàng -> 20 điểm, không cộng thêm logic đặc biệt.)
      const delta = computeVcnvFinalScore(passedHorizontalsCount);

      // === 2) REVEAL ALL: Tạo answers cho tất cả hàng/ô VCNV chưa mở (phục vụ UI mở hình) ===
      // Lấy danh sách ô nào đã có answer (với is_correct != null)
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
    }

    // Fallback: nếu không load được round_questions (không vào nhánh reveal-all ở trên)
    // vẫn cố gắng tính điểm theo mặc định 60.
    const fallbackDelta = computeVcnvFinalScore(0);
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
      delta: fallbackDelta,
    });
    if (scoreErr) return { error: scoreErr };

    const { error: auditErr } = await insertScoreChange({
      olympia,
      matchId,
      playerId: answer.player_id,
      roundType: "vcnv",
      requestedDelta: fallbackDelta,
      appliedDelta,
      pointsBefore,
      pointsAfter,
      source: "vcnv_final_confirm",
      createdBy: appUserId ?? null,
    });
    if (auditErr) {
      console.warn("[Olympia] insertScoreChange(vcnv final) failed:", auditErr);
    }

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
      success: `Đã xác nhận ĐÚNG. Cộng ${fallbackDelta} điểm (CNV). Điểm vòng CNV hiện tại: ${nextPoints}.`,
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
      // Revalidate để client cập nhật UI
      revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);
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

    // Revalidate để client cập nhật UI
    revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);

    return { success: `Đã chấm Tăng tốc (batch) cho ${items.length} quyết định.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể chấm batch." };
  }
}

export async function confirmDecisionsBatchFormAction(formData: FormData): Promise<void> {
  const result = await confirmDecisionsBatchAction({}, formData);
  // Log kết quả để debug nếu cần, nhưng formAction chỉ return void
  if (result.error) {
    console.error("[Olympia] confirmDecisionsBatchFormAction error:", result.error);
  } else {
    console.info("[Olympia] confirmDecisionsBatchFormAction success:", result.success);
  }
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

    type StarUseLookupRow = {
      id: string;
      round_question_id: string | null;
      outcome: string | null;
    };
    const { data: existingStars, error: existingStarError } = await olympia
      .from("star_uses")
      .select("id, round_question_id, outcome")
      .eq("match_id", parsed.data.matchId)
      .eq("player_id", parsed.data.playerId);
    if (existingStarError) return { error: existingStarError.message };

    const starRows = (existingStars as StarUseLookupRow[] | null) ?? [];
    const isLocked = starRows.some((row) => row.outcome !== null);
    const currentStar =
      starRows.find((row) => row.round_question_id === parsed.data.roundQuestionId) ?? null;

    if (!parsed.data.enabled) {
      if (isLocked) {
        return { error: "Thí sinh đã dùng ngôi sao hy vọng, không thể hủy." };
      }
      if (!currentStar?.id) {
        return { success: "Đã tắt Star." };
      }
      const { error: delError } = await olympia
        .from("star_uses")
        .delete()
        .eq("match_id", parsed.data.matchId)
        .eq("round_question_id", parsed.data.roundQuestionId)
        .eq("player_id", parsed.data.playerId);
      if (delError) return { error: delError.message };
      return { success: "Đã tắt Star." };
    }

    if (isLocked) {
      return { error: "Thí sinh đã dùng ngôi sao hy vọng, không thể bật lại." };
    }

    if (currentStar?.id) {
      return { success: "Ngôi sao hy vọng đã được bật." };
    }

    const otherStarIds = starRows
      .filter((row) => row.round_question_id !== parsed.data.roundQuestionId)
      .map((row) => row.id);
    if (otherStarIds.length > 0) {
      const { error: clearError } = await olympia.from("star_uses").delete().in("id", otherStarIds);
      if (clearError) return { error: clearError.message };
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

export async function toggleStarUseFormAction(formData: FormData): Promise<ActionState> {
  const result = await toggleStarUseAction({}, formData);
  if (result.error) {
    console.error("[Olympia] toggleStarUseFormAction error:", result.error);
  }
  return result;
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
      // Về đích: KHÔNG auto chuyển câu, giữ nguyên câu hỏi trên màn hình.
      const { error: completeErr } = await olympia
        .from("live_sessions")
        .update({
          question_state: "completed",
          timer_deadline: null,
          buzzer_enabled: false,
        })
        .eq("id", session.id);
      if (completeErr) return { error: completeErr.message };
    } else {
      // Sai/Hết giờ → mở cửa cướp
      const { buzzTimeMs } = getVeDichStealTimingMs();
      const stealDeadline = new Date(Date.now() + buzzTimeMs).toISOString();
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

    const mainPlayerId = rq.target_player_id ?? null;
    const { data: starRow, error: starErr } = mainPlayerId
      ? await olympia
          .from("star_uses")
          .select("id")
          .eq("match_id", session.match_id)
          .eq("round_question_id", rq.id)
          .eq("player_id", mainPlayerId)
          .maybeSingle()
      : { data: null, error: null };
    if (starErr) return { error: starErr.message };
    const starEnabled = Boolean(starRow?.id);

    // Luật cướp điểm:
    // - Đúng: lấy điểm từ quỹ điểm của thí sinh đang thi (chuyển từ thí sinh chính sang người cướp)
    // - Sai/Hết giờ: người cướp bị trừ 50% điểm câu
    if (isCorrect) {
      if (!mainPlayerId) return { error: "Chưa có thí sinh chính để trừ quỹ điểm." };

      const gain = await applyRoundDelta({
        olympia,
        matchId: session.match_id,
        playerId: stealWinner.player_id,
        roundType: "ve_dich",
        delta: value,
      });
      if (gain.error) return { error: gain.error };

      const shouldTransferFromMain = !starEnabled;
      const loss = shouldTransferFromMain
        ? await applyRoundDelta({
            olympia,
            matchId: session.match_id,
            playerId: mainPlayerId,
            roundType: "ve_dich",
            delta: -value,
          })
        : null;
      if (loss && loss.error) return { error: loss.error };

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

      if (shouldTransferFromMain && loss) {
        const { error: auditLossErr } = await insertScoreChange({
          olympia,
          matchId: session.match_id,
          playerId: mainPlayerId,
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
        success: starEnabled
          ? `Cướp ĐÚNG (+${value}), không trừ điểm thí sinh chính (đã dùng Sao).`
          : `Cướp ĐÚNG (+${value}), đã trừ ${value} từ thí sinh chính.`,
      };
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
