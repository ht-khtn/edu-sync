"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
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
 * Map question code prefix to round_type.
 * KD* → khoi_dong, VCNV* → vcnv, TT* → tang_toc, VD* → ve_dich
 */
function parseQuestionRoundType(code: string): string | null {
  const upper = code.toUpperCase().trim();
  if (upper.startsWith("KD")) return "khoi_dong";
  if (upper.startsWith("VCNV") || upper.startsWith("CNV")) return "vcnv";
  if (upper.startsWith("TT")) return "tang_toc";
  if (upper.startsWith("VD")) return "ve_dich";
  return null;
}

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
  roundId: z.string().uuid("Vòng không hợp lệ."),
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

const obstacleGuessSubmitSchema = z.object({
  sessionId: z.string().uuid("Phòng thi không hợp lệ."),
  guessText: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Vui lòng nhập dự đoán CNV."),
});

const obstacleGuessConfirmSchema = z.object({
  guessId: z.string().uuid("Lượt đoán không hợp lệ."),
  decision: z.enum(["correct", "wrong"]),
});

const openObstacleTileSchema = z.object({
  tileId: z.string().uuid("Ô CNV không hợp lệ."),
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
});

const setRoundQuestionTargetSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
  roundQuestionId: z.string().uuid("Câu hỏi không hợp lệ."),
  // Cho phép bỏ chọn ("Thi chung") bằng cách gửi chuỗi rỗng.
  playerId: z.union([z.string().uuid(), z.literal("")]).transform((val) => (val ? val : null)),
});

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
        question_state: "hidden",
      })
      .eq("match_id", matchId)
      .eq("status", "running")
      .select("id");

    if (error) return { error: error.message };
    if (!updatedRows || updatedRows.length === 0) {
      return { error: "Phòng chưa ở trạng thái running." };
    }

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);

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

    const nextDeadline =
      questionState === "showing" ? new Date(Date.now() + 5000).toISOString() : null;

    const { error } = await olympia
      .from("live_sessions")
      .update({ question_state: questionState, timer_deadline: nextDeadline })
      .eq("id", session.id);

    if (error) return { error: error.message };

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);

    return { success: `Đã cập nhật trạng thái câu hỏi: ${questionState}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật trạng thái." };
  }
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

    revalidatePath("/olympia/admin/matches");
    revalidatePath(`/olympia/admin/matches/${matchId}`);
    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    revalidatePath("/olympia/client");

    return { success: enabled ? "Đã bật bấm chuông." : "Đã tắt bấm chuông." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể cập nhật bấm chuông." };
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
      .select("id, status, match_id, current_round_question_id, current_round_type, question_state")
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
      .select("id, match_round_id, target_player_id")
      .eq("id", session.current_round_question_id)
      .maybeSingle();

    if (rqError) return { error: rqError.message };
    if (!roundQuestion) return { error: "Không tìm thấy câu hỏi hiện tại." };

    // Khởi động lượt cá nhân: nếu round_questions.target_player_id có giá trị,
    // chỉ thí sinh đó mới được gửi đáp án.
    // Ngoại lệ: Về đích mở cửa cướp (question_state='answer_revealed') → chỉ steal-winner mới được trả lời.
    if (roundQuestion.target_player_id && roundQuestion.target_player_id !== playerRow.id) {
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
      } else {
        return { error: "Đây là lượt cá nhân, bạn không phải người được chọn." };
      }
    }

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

    // Khởi động lượt cá nhân: không cho bấm chuông.
    const { data: rq, error: rqError } = await olympia
      .from("round_questions")
      .select("id, target_player_id")
      .eq("id", session.current_round_question_id)
      .maybeSingle();
    if (rqError) return { error: rqError.message };
    if (rq?.target_player_id) {
      if (session.current_round_type === "ve_dich" && isVeDichStealWindow) {
        if (rq.target_player_id === playerRow.id) {
          return { error: "Bạn là người đang trả lời chính, không thể bấm cướp." };
        }
        if (playerRow.is_disqualified_obstacle) {
          return { error: "Bạn đang bị loại khỏi quyền cướp." };
        }
      } else {
        return { error: "Câu này là lượt cá nhân, không dùng buzzer." };
      }
    }

    const eventType = isVeDichStealWindow ? "steal" : "buzz";

    // Nếu đã có người thắng, không cho nhận thêm.
    const { data: firstBuzz, error: buzzError } = await olympia
      .from("buzzer_events")
      .select("id, player_id, result, occurred_at")
      .eq("round_question_id", session.current_round_question_id)
      .eq("event_type", eventType)
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
    const { supabase, appUserId } = await getServerAuthContext();
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

    // Để chấm đúng luật vòng 1, cần biết đây là thi riêng hay thi chung.
    let currentTargetPlayerId: string | null = null;
    if (session.current_round_question_id) {
      const { data: rqRow, error: rqErr } = await olympia
        .from("round_questions")
        .select("id, target_player_id")
        .eq("id", session.current_round_question_id)
        .maybeSingle();
      if (rqErr) return { error: rqErr.message };
      currentTargetPlayerId = (rqRow?.target_player_id as string | null) ?? null;

      // Enforce: vòng Khởi động thi chung chỉ chấm cho người bấm chuông thắng.
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
      // - Thi riêng (có target_player_id): đúng +10, sai/hết giờ 0.
      // - Thi chung (target null): đúng +10, sai/hết giờ -5, clamp 0.
      if (currentTargetPlayerId) {
        delta = decision === "correct" ? 10 : 0;
        nextPoints = currentPoints + delta;
      } else {
        const computed = computeKhoiDongCommonScore(decision, currentPoints);
        delta = computed.delta;
        nextPoints = computed.nextPoints;
      }
    } else {
      // Hiện tại các vòng khác dùng UI chấm riêng (VD, TT auto, ...).
      // Giữ hành vi cũ để tránh ảnh hưởng ngoài phạm vi vòng 1.
      const computed = computeKhoiDongCommonScore(decision, currentPoints);
      delta = computed.delta;
      nextPoints = computed.nextPoints;
    }
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
            points_awarded: delta,
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

    revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);
    if (session.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
    }

    return { success: `Đã xác nhận: ${decision}. Điểm mới: ${nextPoints}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể xác nhận kết quả." };
  }
}

// Wrapper dùng trực tiếp cho <form action={...}> trong Server Component.
// Next.js form action chỉ truyền 1 tham số (FormData).
export async function confirmDecisionFormAction(formData: FormData): Promise<void> {
  await confirmDecisionAction({}, formData);
}

export async function setCurrentQuestionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = setCurrentQuestionSchema.safeParse({
      matchId: formData.get("matchId"),
      roundQuestionId: formData.get("roundQuestionId"),
      durationMs: formData.get("durationMs") ? Number(formData.get("durationMs")) : undefined,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin câu hỏi." };
    }

    const { matchId, roundQuestionId, durationMs } = parsed.data;
    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận chưa mở phòng live." };
    if (session.status !== "running") return { error: "Phòng chưa ở trạng thái running." };

    const { data: roundQuestion, error: rqError } = await olympia
      .from("round_questions")
      .select("id, match_round_id")
      .eq("id", roundQuestionId)
      .maybeSingle();
    if (rqError) return { error: rqError.message };
    if (!roundQuestion) return { error: "Không tìm thấy câu hỏi." };

    const deadline = new Date(Date.now() + durationMs).toISOString();

    const { error: updateError } = await olympia
      .from("live_sessions")
      .update({
        current_round_id: roundQuestion.match_round_id,
        current_round_question_id: roundQuestion.id,
        // Đổi câu luôn tự tắt màn chờ để hiển thị câu mới.
        question_state: "showing",
        timer_deadline: deadline,
      })
      .eq("id", session.id);

    if (updateError) return { error: updateError.message };

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
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
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
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
      .select("id, status, current_round_id, current_round_question_id")
      .eq("match_id", matchId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận chưa mở phòng live." };
    if (session.status !== "running") return { error: "Phòng chưa ở trạng thái running." };
    if (!session.current_round_id) return { error: "Chưa chọn vòng hiện tại." };

    const { data: questions, error: qError } = await olympia
      .from("round_questions")
      .select("id, order_index")
      .eq("match_round_id", session.current_round_id)
      .order("order_index", { ascending: true });
    if (qError) return { error: qError.message };
    const list = questions ?? [];
    if (list.length === 0) return { error: "Vòng này chưa có câu hỏi." };

    const currentIdx = session.current_round_question_id
      ? list.findIndex((q) => q.id === session.current_round_question_id)
      : -1;

    const nextIdx =
      direction === "next"
        ? Math.min(list.length - 1, currentIdx + 1)
        : Math.max(0, currentIdx - 1);

    const nextQuestion = list[nextIdx];
    if (!nextQuestion) return { error: "Không tìm thấy câu tiếp theo." };

    const timerDeadline = autoShow ? new Date(Date.now() + durationMs).toISOString() : null;

    const { error: updateError } = await olympia
      .from("live_sessions")
      .update({
        current_round_question_id: nextQuestion.id,
        // Đổi câu luôn tự tắt màn chờ. Nếu không autoShow, vẫn tắt màn chờ nhưng không chạy timer.
        question_state: "showing",
        timer_deadline: timerDeadline,
      })
      .eq("id", session.id);

    if (updateError) return { error: updateError.message };

    revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    return { success: autoShow ? "Đã chuyển & hiển thị câu mới." : "Đã chuyển sang câu mới." };
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
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
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
  try {
    const { supabase, authUid, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");
    if (!authUid || !appUserId) {
      return { error: "Bạn cần đăng nhập để dự đoán CNV." };
    }

    const parsed = obstacleGuessSubmitSchema.safeParse({
      sessionId: formData.get("sessionId"),
      guessText: formData.get("guessText"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu dự đoán không hợp lệ." };
    }

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status, match_id, current_round_id, current_round_type")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();

    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Không tìm thấy phòng thi." };
    if (session.status !== "running") return { error: "Phòng chưa ở trạng thái running." };
    if (!session.match_id || !session.current_round_id)
      return { error: "Phòng chưa gắn trận/vòng hiện tại." };
    if (session.current_round_type !== "vcnv")
      return { error: "Hiện không ở vòng Vượt chướng ngại vật." };

    const { data: playerRow, error: playerError } = await olympia
      .from("match_players")
      .select("id, is_disqualified_obstacle")
      .eq("match_id", session.match_id)
      .eq("participant_id", appUserId)
      .maybeSingle();

    if (playerError) return { error: playerError.message };
    if (!playerRow) return { error: "Bạn không thuộc trận này." };
    if (playerRow.is_disqualified_obstacle) {
      return { error: "Bạn đã bị loại khỏi quyền đoán CNV." };
    }

    const { data: obstacle, error: obstacleError } = await olympia
      .from("obstacles")
      .select("id")
      .eq("match_round_id", session.current_round_id)
      .maybeSingle();
    if (obstacleError) return { error: obstacleError.message };
    if (!obstacle) return { error: "Vòng này chưa có CNV." };

    const { count, error: countError } = await olympia
      .from("obstacle_guesses")
      .select("id", { count: "exact", head: true })
      .eq("obstacle_id", obstacle.id)
      .eq("player_id", playerRow.id);
    if (countError) return { error: countError.message };

    const attemptOrder = (count ?? 0) + 1;
    const { error: insertError } = await olympia.from("obstacle_guesses").insert({
      obstacle_id: obstacle.id,
      player_id: playerRow.id,
      guess_text: parsed.data.guessText,
      attempt_order: attemptOrder,
      attempted_at: new Date().toISOString(),
    });
    if (insertError) return { error: insertError.message };

    return { success: "Đã ghi nhận dự đoán CNV. Host sẽ xác nhận." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể gửi dự đoán CNV." };
  }
}

export async function confirmVcnvRowDecisionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
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
      answerId: latestAnswer?.id ?? null,
    });
    if (auditErr) {
      console.warn("[Olympia] insertScoreChange(vcnv row) failed:", auditErr);
    }

    if (decision === "correct" && session.current_round_id) {
      const { data: obstacle, error: obstacleError } = await olympia
        .from("obstacles")
        .select("id")
        .eq("match_round_id", session.current_round_id)
        .maybeSingle();
      if (obstacleError) return { error: obstacleError.message };
      if (obstacle?.id) {
        const { error: tileError } = await olympia
          .from("obstacle_tiles")
          .update({ is_open: true })
          .eq("obstacle_id", obstacle.id)
          .eq("round_question_id", session.current_round_question_id);
        if (tileError) return { error: tileError.message };
      }
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
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = obstacleGuessConfirmSchema.safeParse({
      guessId: formData.get("guessId"),
      decision: formData.get("decision"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin xác nhận CNV." };
    }

    const { data: guess, error: guessError } = await olympia
      .from("obstacle_guesses")
      .select("id, obstacle_id, player_id, is_correct")
      .eq("id", parsed.data.guessId)
      .maybeSingle();
    if (guessError) return { error: guessError.message };
    if (!guess) return { error: "Không tìm thấy lượt đoán." };

    const { data: obstacleRow, error: obstacleError } = await olympia
      .from("obstacles")
      .select("id, match_round_id, match_rounds!inner(match_id)")
      .eq("id", guess.obstacle_id)
      .maybeSingle();
    if (obstacleError) return { error: obstacleError.message };
    if (!obstacleRow) return { error: "Không tìm thấy CNV." };

    const join = (obstacleRow as { match_rounds?: { match_id: string } | { match_id: string }[] })
      .match_rounds;
    const matchId = Array.isArray(join) ? join[0]?.match_id : join?.match_id;
    if (!matchId) return { error: "Không xác định được trận thi của CNV." };

    if (parsed.data.decision === "wrong") {
      const { error: updateGuessError } = await olympia
        .from("obstacle_guesses")
        .update({ is_correct: false })
        .eq("id", guess.id);
      if (updateGuessError) return { error: updateGuessError.message };

      const { error: dqError } = await olympia
        .from("match_players")
        .update({ is_disqualified_obstacle: true })
        .eq("id", guess.player_id);
      if (dqError) return { error: dqError.message };

      revalidatePath(`/olympia/admin/matches/${matchId}/host`);
      return { success: "Đã xác nhận SAI và loại quyền đoán CNV cho thí sinh." };
    }

    if (guess.is_correct) {
      revalidatePath(`/olympia/admin/matches/${matchId}/host`);
      return { success: "Lượt đoán này đã được xác nhận đúng trước đó." };
    }

    const { error: updateGuessError } = await olympia
      .from("obstacle_guesses")
      .update({ is_correct: true })
      .eq("id", guess.id);
    if (updateGuessError) return { error: updateGuessError.message };

    const { count: openedCount, error: openedError } = await olympia
      .from("obstacle_tiles")
      .select("id", { count: "exact", head: true })
      .eq("obstacle_id", guess.obstacle_id)
      .eq("is_open", true);
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
      playerId: guess.player_id,
      roundType: "vcnv",
      delta,
    });
    if (scoreErr) return { error: scoreErr };

    const { error: auditErr } = await insertScoreChange({
      olympia,
      matchId,
      playerId: guess.player_id,
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

    const { error: openAllError } = await olympia
      .from("obstacle_tiles")
      .update({ is_open: true })
      .eq("obstacle_id", guess.obstacle_id);
    if (openAllError) return { error: openAllError.message };

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

export async function openObstacleTileAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = openObstacleTileSchema.safeParse({ tileId: formData.get("tileId") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin ô CNV." };
    }

    const { data: tile, error: tileError } = await olympia
      .from("obstacle_tiles")
      .select("id, obstacle_id")
      .eq("id", parsed.data.tileId)
      .maybeSingle();
    if (tileError) return { error: tileError.message };
    if (!tile) return { error: "Không tìm thấy ô CNV." };

    const { data: obstacleRow, error: obstacleError } = await olympia
      .from("obstacles")
      .select("id, match_round_id, match_rounds!inner(match_id)")
      .eq("id", tile.obstacle_id)
      .maybeSingle();
    if (obstacleError) return { error: obstacleError.message };

    const join = (obstacleRow as { match_rounds?: { match_id: string } | { match_id: string }[] })
      ?.match_rounds;
    const matchId = Array.isArray(join) ? join[0]?.match_id : join?.match_id;

    const { error: updateError } = await olympia
      .from("obstacle_tiles")
      .update({ is_open: true })
      .eq("id", tile.id);
    if (updateError) return { error: updateError.message };

    if (matchId) {
      revalidatePath(`/olympia/admin/matches/${matchId}/host`);
    }
    return { success: "Đã mở ô CNV." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể mở ô CNV." };
  }
}

export async function openObstacleTileFormAction(formData: FormData): Promise<void> {
  await openObstacleTileAction({}, formData);
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
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
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
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = veDichValueSchema.safeParse({
      matchId: formData.get("matchId"),
      roundQuestionId: formData.get("roundQuestionId"),
      value: Number(formData.get("value")),
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

    const { error: updateError } = await olympia
      .from("round_questions")
      .update({ meta: nextMeta })
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
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin target." };
    }

    const { error } = await olympia
      .from("round_questions")
      .update({ target_player_id: parsed.data.playerId })
      .eq("id", parsed.data.roundQuestionId);
    if (error) return { error: error.message };

    revalidatePath(`/olympia/admin/matches/${parsed.data.matchId}/host`);

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

export async function toggleStarUseAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
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
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
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
      .select("id, status, current_round_type")
      .eq("match_id", parsed.data.matchId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận chưa mở phòng live." };
    if (session.status !== "running") return { error: "Phòng chưa ở trạng thái running." };
    if (session.current_round_type !== "ve_dich") return { error: "Hiện không ở vòng Về đích." };

    const deadline = new Date(Date.now() + parsed.data.durationMs).toISOString();
    const { error: updateError } = await olympia
      .from("live_sessions")
      .update({ question_state: "answer_revealed", timer_deadline: deadline })
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
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
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
    const delta = isCorrect ? value * (starEnabled ? 2 : 1) : 0;

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
        .update({ is_correct: isCorrect, points_awarded: delta })
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

    revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);
    if (session.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
      revalidatePath(`/olympia/client/guest/${session.join_code}`);
    }

    return { success: isCorrect ? `Đã chấm ĐÚNG (+${delta}).` : "Đã chấm SAI/HẾT GIỜ (0)." };
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
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
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
      .select("id, meta")
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
    const penalty = Math.ceil(value / 2);
    const delta = isCorrect ? value : -penalty;

    const {
      pointsBefore,
      pointsAfter,
      appliedDelta,
      error: scoreErr,
    } = await applyRoundDelta({
      olympia,
      matchId: session.match_id,
      playerId: stealWinner.player_id,
      roundType: "ve_dich",
      delta,
    });
    if (scoreErr) return { error: scoreErr };

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
        .update({ is_correct: isCorrect, points_awarded: delta })
        .eq("id", latestAnswer.id);
      if (updateAnswerError) return { error: updateAnswerError.message };
    }

    const { error: auditErr } = await insertScoreChange({
      olympia,
      matchId: session.match_id,
      playerId: stealWinner.player_id,
      roundType: "ve_dich",
      requestedDelta: delta,
      appliedDelta,
      pointsBefore,
      pointsAfter,
      source: "ve_dich_steal_confirm",
      createdBy: appUserId ?? null,
      roundQuestionId: rq.id,
      answerId: latestAnswer?.id ?? null,
    });
    if (auditErr) {
      console.warn("[Olympia] insertScoreChange(ve dich steal) failed:", auditErr);
    }

    revalidatePath(`/olympia/admin/matches/${session.match_id}/host`);
    if (session.join_code) {
      revalidatePath(`/olympia/client/game/${session.join_code}`);
      revalidatePath(`/olympia/client/guest/${session.join_code}`);
    }

    return {
      success: isCorrect ? `Cướp ĐÚNG (+${value}).` : `Cướp SAI/HẾT GIỜ (-${penalty}).`,
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
        "Không nhận diện được mã câu. Code cần bắt đầu bằng KD/VCNV(CNV)/TT/VD (không phân biệt hoa/thường)."
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
  questionSetIds: z.array(z.string().uuid()).default([]),
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
