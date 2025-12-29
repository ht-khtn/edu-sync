"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { z } from "zod";
import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";
import { getServerAuthContext, getServerSupabase } from "@/lib/server-auth";

export type ActionState = {
  error?: string | null;
  success?: string | null;
  data?: Record<string, unknown> | null;
};

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
    .uuid()
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

const updateMatchQuestionSetsSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  questionSetIds: z.array(z.string().uuid()).default([]),
});

const MAX_QUESTION_SET_FILE_SIZE = 5 * 1024 * 1024; // 5MB safety limit

type ParsedQuestionSetItem = {
  code: string;
  category: string | null;
  question_text: string;
  answer_text: string;
  note: string | null;
  submitted_by: string | null;
  source: string | null;
  image_url: string | null;
  audio_url: string | null;
  order_index: number;
};

/**
 * Parses code format to extract round/question info.
 * Supports formats: KD{i}-{n}, DKA-{n}, VCNV-{n}, VCNV-OTT, CNV, TT{n}, VD-{s}.{n}, CHP-{i}
 * Returns normalized code (uppercase) and metadata.
 */
function parseQuestionCode(rawCode: string): {
  normalizedCode: string;
  isTT: boolean;
  ttNumber?: number;
} {
  const normalized = rawCode.toUpperCase().trim();

  // Check if TT{n} (Tăng tốc)
  const ttMatch = normalized.match(/^TT(\d+)$/);
  if (ttMatch) {
    return {
      normalizedCode: normalized,
      isTT: true,
      ttNumber: parseInt(ttMatch[1], 10),
    };
  }

  return {
    normalizedCode: normalized,
    isTT: false,
  };
}

async function parseQuestionSetWorkbook(buffer: Buffer | ArrayBuffer | Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS expects a Node Buffer; normalize input properly
  let nodeBuffer: Buffer;
  if (Buffer.isBuffer(buffer)) {
    nodeBuffer = buffer;
  } else if (buffer instanceof ArrayBuffer) {
    nodeBuffer = Buffer.from(buffer) as unknown as Buffer;
  } else {
    nodeBuffer = Buffer.from(buffer) as unknown as Buffer;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(nodeBuffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("File không có sheet hợp lệ.");
  }

  const items: ParsedQuestionSetItem[] = [];
  const codeSet = new Set<string>();
  let skipped = 0;

  // First pass: collect all rows
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const cells = Array.from({ length: 9 }, (_, index) => row.getCell(index + 1));
    const values = cells.map((cell) =>
      typeof cell.text === "string" ? cell.text.trim() : String(cell.text || "").trim()
    );
    rows.push(values);
  });

  // Second pass: process rows with TT merge handling
  let i = 0;
  while (i < rows.length) {
    const values = rows[i];
    const [
      rawCode,
      rawCategory,
      rawQuestion,
      rawAnswer,
      rawNote,
      rawSender,
      rawSource,
      rawImage,
      rawAudio,
    ] = values;

    const isEmptyRow = values.every((value) => !value || value.length === 0);
    if (isEmptyRow) {
      i += 1;
      continue;
    }

    if (!rawCode || !rawQuestion || !rawAnswer) {
      skipped += 1;
      i += 1;
      continue;
    }

    const codeInfo = parseQuestionCode(rawCode);
    const normalizedCode = codeInfo.normalizedCode;

    if (normalizedCode.length < 3 || normalizedCode.length > 32) {
      skipped += 1;
      i += 1;
      continue;
    }

    if (codeSet.has(normalizedCode)) {
      skipped += 1;
      i += 1;
      continue;
    }

    // Handle TT{n} merge: if code is TT{n}, check next rows for more TT{n} and merge
    let mergedQuestion = rawQuestion;
    let mergedAnswer = rawAnswer;
    let mergedNote = rawNote;
    let mergedImage = rawImage;
    let mergedAudio = rawAudio;

    if (codeInfo.isTT) {
      // Look ahead for consecutive rows with same TT prefix but more data
      let j = i + 1;
      while (j < rows.length) {
        const nextValues = rows[j];
        const nextRawCode = nextValues[0]?.trim() || "";
        const nextRawQuestion = nextValues[2]?.trim() || "";
        const nextRawAnswer = nextValues[3]?.trim() || "";

        // Check if next row is also TT with same number, or is a continuation row
        const nextCodeInfo = parseQuestionCode(nextRawCode);
        const isContinuation =
          nextRawCode === "" ||
          (codeInfo.isTT && nextCodeInfo.isTT && nextCodeInfo.ttNumber === codeInfo.ttNumber);

        if (!isContinuation || (!nextRawQuestion && !nextRawAnswer)) {
          break; // Stop merging if next row doesn't belong to this TT or is empty
        }

        // Merge data with newline separator (for display purposes)
        if (nextRawQuestion) {
          mergedQuestion = mergedQuestion + "\n" + nextRawQuestion;
        }
        if (nextRawAnswer) {
          mergedAnswer = mergedAnswer + "\n" + nextRawAnswer;
        }
        if (nextValues[4]?.trim()) {
          mergedNote = (mergedNote || "") + "\n" + nextValues[4].trim();
        }
        if (nextValues[7]?.trim()) {
          mergedImage = mergedImage || nextValues[7].trim();
        }
        if (nextValues[8]?.trim()) {
          mergedAudio = mergedAudio || nextValues[8].trim();
        }

        j += 1;
      }

      // Skip merged rows
      i = j;
    } else {
      i += 1;
    }

    codeSet.add(normalizedCode);
    items.push({
      code: normalizedCode,
      category: rawCategory?.length ? rawCategory : null,
      question_text: mergedQuestion,
      answer_text: mergedAnswer,
      note: mergedNote?.length ? mergedNote : null,
      submitted_by: rawSender?.length ? rawSender : null,
      source: rawSource?.length ? rawSource : null,
      image_url: mergedImage?.length ? mergedImage : null,
      audio_url: mergedAudio?.length ? mergedAudio : null,
      order_index: items.length,
    });
  }

  return { items, skipped };
}

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
  roundType: z.enum(["khoi_dong", "vcnv", "tang_toc", "ve_dich"]),
});

const questionStateSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
  questionState: z.enum(["hidden", "showing", "answer_revealed", "completed"]),
});

const submitAnswerSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  answer: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Vui lòng nhập đáp án."),
  notes: z
    .string()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : null)),
});

const buzzerSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
});

const decisionSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  playerId: z.string().uuid("Thí sinh không hợp lệ."),
  decision: z.enum(["correct", "wrong", "timeout"]),
});

function generateJoinCode() {
  return `OLY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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
    const { error } = await olympia.from("matches").insert({
      name: payload.name,
      tournament_id: payload.tournamentId,
      scheduled_at: payload.scheduledAt,
      status: "draft",
      host_user_id: appUserId,
    });

    if (error) return { error: error.message };

    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    return { success: "Đã tạo trận mới." };
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
    const { error } = await olympia.from("questions").insert({
      code: payload.code.toUpperCase(),
      category: payload.category,
      question_text: payload.questionText,
      answer_text: payload.answerText,
      note: payload.note,
      created_by: appUserId,
      submitted_by: appUserId ?? "unknown",
    });

    if (error) return { error: error.message };

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
      const slice = items.slice(i, i + batchSize).map((item) => ({
        question_set_id: createdSet.id,
        ...item,
      }));

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
    const { authUid } = await getServerAuthContext();
    if (!authUid) return { error: "Bạn cần đăng nhập để tham gia phòng." };

    const parsed = joinSchema.safeParse({
      joinCode: formData.get("joinCode"),
      playerPassword: formData.get("playerPassword"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Mã tham gia không hợp lệ." };
    }

    const supabase = await getServerSupabase();
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

    // Record verification on server for cross-device persistence
    const { error: verifyError } = await olympia.from("session_verifications").upsert(
      {
        session_id: data.id,
        user_id: authUid,
        verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "session_id,user_id" }
    );

    if (verifyError) {
      console.error("[Olympia] Failed to record session verification:", verifyError);
      // Continue anyway - verification is secondary
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

    // Resolve match code to return a user-friendly identifier for client routing
    const { data: matchRow, error: matchRowErr } = await olympia
      .from("matches")
      .select("code")
      .eq("id", session.match_id)
      .maybeSingle();

    if (matchRowErr) {
      return { error: matchRowErr.message };
    }

    const matchCode = matchRow?.code ?? session.match_id;

    if (session.status !== "running") {
      return {
        success: "Mật khẩu đúng, nhưng phòng chưa chạy. Bạn vẫn có thể xem chế độ chuẩn bị.",
        data: { matchCode },
      };
    }

    return { success: "Đã mở khóa chế độ xem MC.", data: { matchCode } };
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
      roundType: formData.get("roundType"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin vòng." };
    }

    const { matchId, roundType } = parsed.data;
    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận chưa mở phòng live." };
    if (session.status !== "running") {
      return { error: "Phòng chưa ở trạng thái running." };
    }

    const { data: roundRow, error: roundError } = await olympia
      .from("match_rounds")
      .select("id")
      .eq("match_id", matchId)
      .eq("round_type", roundType)
      .maybeSingle();
    if (roundError) return { error: roundError.message };
    if (!roundRow) return { error: "Trận chưa cấu hình vòng này." };

    const { error } = await olympia
      .from("live_sessions")
      .update({
        current_round_id: roundRow.id,
        current_round_type: roundType,
        question_state: "hidden",
      })
      .eq("id", session.id);

    if (error) return { error: error.message };

    revalidatePath("/olympia/admin/matches");
    revalidatePath(`/olympia/admin/matches/${matchId}`);
    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    revalidatePath("/olympia/client");

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

    const { error } = await olympia
      .from("live_sessions")
      .update({ question_state: questionState })
      .eq("id", session.id);

    if (error) return { error: error.message };

    revalidatePath("/olympia/admin/matches");
    revalidatePath(`/olympia/admin/matches/${matchId}`);
    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    revalidatePath("/olympia/client");

    return { success: `Đã cập nhật trạng thái câu hỏi: ${questionState}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật trạng thái." };
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
      .select("id, status, match_id, current_round_question_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (session.status !== "running") {
      return { error: "Phòng chưa mở nhận đáp án." };
    }
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };
    if (!session.current_round_question_id) return { error: "Chưa có câu hỏi đang mở." };

    const { data: playerRow, error: playerError } = await olympia
      .from("match_players")
      .select("id")
      .eq("match_id", session.match_id)
      .eq("participant_id", appUserId)
      .maybeSingle();

    if (playerError) return { error: playerError.message };
    if (!playerRow) return { error: "Bạn không thuộc trận này." };

    const { data: roundQuestion, error: rqError } = await olympia
      .from("round_questions")
      .select("id, match_round_id")
      .eq("id", session.current_round_question_id)
      .maybeSingle();

    if (rqError) return { error: rqError.message };
    if (!roundQuestion) return { error: "Không tìm thấy câu hỏi hiện tại." };

    const submittedAt = new Date().toISOString();
    const { error: insertError } = await olympia.from("answers").insert({
      match_id: session.match_id,
      match_round_id: roundQuestion.match_round_id,
      round_question_id: roundQuestion.id,
      player_id: playerRow.id,
      answer_text: parsed.data.answer,
      response_time_ms: null,
      submitted_at: submittedAt,
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
      .select("id, status, match_id, current_round_question_id, question_state")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (session.status !== "running") {
      return { error: "Phòng chưa sẵn sàng nhận tín hiệu buzzer." };
    }
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };
    if (!session.current_round_question_id) return { error: "Chưa có câu hỏi đang hiển thị." };
    if (session.question_state !== "showing") {
      return { error: "Host chưa mở câu hỏi để nhận buzzer." };
    }

    const { data: playerRow, error: playerError } = await olympia
      .from("match_players")
      .select("id")
      .eq("match_id", session.match_id)
      .eq("participant_id", appUserId)
      .maybeSingle();

    if (playerError) return { error: playerError.message };
    if (!playerRow) return { error: "Bạn không thuộc trận này." };

    // Nếu đã có người thắng, không cho nhận thêm.
    const { data: firstBuzz, error: buzzError } = await olympia
      .from("buzzer_events")
      .select("id, player_id, result, occurred_at")
      .eq("round_question_id", session.current_round_question_id)
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
      event_type: "buzz",
      result: isWinner ? "win" : "lose",
      occurred_at: now,
    });

    if (insertError) return { error: insertError.message };

    return {
      success: isWinner
        ? "Bạn đã giành quyền trả lời."
        : "Đã ghi nhận tín hiệu (không phải người nhanh nhất).",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể gửi tín hiệu buzzer." };
  }
}

export async function confirmDecisionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
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

    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (!session.match_id) return { error: "Phòng chưa gắn trận thi." };

    const roundType = session.current_round_type ?? "khoi_dong";
    const delta = decision === "correct" ? 10 : -5;

    const { data: scoreRow, error: scoreError } = await olympia
      .from("match_scores")
      .select("id, points")
      .eq("match_id", session.match_id)
      .eq("player_id", playerId)
      .eq("round_type", roundType)
      .maybeSingle();

    if (scoreError) return { error: scoreError.message };

    const currentPoints = scoreRow?.points ?? 0;
    const nextPoints = Math.max(0, currentPoints + delta);

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

    // Cập nhật đáp án mới nhất (nếu có) để lưu điểm và trạng thái đúng/sai.
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
        const { error: updateAnswerError } = await olympia
          .from("answers")
          .update({
            is_correct: decision === "correct",
            points_awarded: delta,
          })
          .eq("id", latestAnswer.id);
        if (updateAnswerError) return { error: updateAnswerError.message };
      }
    }

    revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);
    if (session.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
    }

    return { success: `Đã xác nhận: ${decision}. Điểm mới: ${nextPoints}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể xác nhận kết quả." };
  }
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
          .uuid()
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

    revalidatePath(`/olympia/admin/matches/${matchId}`);
    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    return { success: "Đã cập nhật bộ đề cho trận." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể gán bộ đề cho trận." };
  }
}

const updateMatchPlayersOrderSchema = z.object({
  matchId: z.string().uuid("ID trận không hợp lệ."),
  playerOrder: z.array(
    z.object({
      playerId: z.string().uuid(),
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
