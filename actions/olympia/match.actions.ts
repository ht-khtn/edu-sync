"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  extractRequiredAssetBasenames,
  normalizeAssetBasename,
  parseQuestionSetWorkbook,
} from "@/lib/olympia/question-set-workbook";
import { requireOlympiaAdminContext } from "@/lib/olympia/olympia-auth";
import { getServerAuthContext } from "@/lib/server-auth";

export type ActionState = {
  error?: string | null;
  success?: string | null;
  data?: Record<string, unknown> | null;
};

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

const matchIdSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
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

export async function createMatchAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, appUserId } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

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

export async function deleteMatchAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const parsed = matchIdSchema.safeParse({ matchId: formData.get("matchId") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
    }

    const { matchId } = parsed.data;

    const { error } = await olympia.from("matches").delete().eq("id", matchId);
    if (error) return { error: error.message };

    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    revalidatePath(`/olympia/admin/matches/${matchId}`);
    revalidatePath(`/olympia/admin/matches/${matchId}/host`);

    return { success: "Đã xóa trận." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể xóa trận." };
  }
}

export async function createQuestionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase, appUserId } = await requireOlympiaAdminContext();
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
    const { supabase, appUserId } = await requireOlympiaAdminContext();
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

export async function updateMatchAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await requireOlympiaAdminContext();
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
    const { supabase } = await requireOlympiaAdminContext();
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
    const { supabase } = await requireOlympiaAdminContext();
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

    // To avoid "duplicate key value violates unique constraint" on (match_id, seat_index),
    // we use a two-phase update strategy:
    // Phase 1: Set all affected player seat_index to NULL
    // Phase 2: Update each player with their new seat_index

    const playerIds = playerOrder.map((p) => p.playerId);

    if (playerIds.length === 0) {
      return { error: "Danh sách thí sinh trống." };
    }

    // Phase 1: Reset all seat_index to NULL for players being reordered
    const { error: resetError } = await olympia
      .from("match_players")
      .update({ seat_index: null })
      .in("id", playerIds)
      .eq("match_id", matchId);

    if (resetError) {
      return { error: resetError.message || "Không thể cập nhật thứ tự thí sinh (phase 1)." };
    }

    // Phase 2: Update each player with their new seat_index
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
      return { error: firstError?.message || "Không thể cập nhật thứ tự thí sinh (phase 2)." };
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
    const { supabase } = await requireOlympiaAdminContext();
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
    const { supabase } = await requireOlympiaAdminContext();
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
    const { supabase } = await requireOlympiaAdminContext();
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
    const { supabase } = await requireOlympiaAdminContext();
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
    const { supabase } = await requireOlympiaAdminContext();
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
    const { supabase } = await requireOlympiaAdminContext();
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

export async function deleteTournamentAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase } = await requireOlympiaAdminContext();
    const olympia = supabase.schema("olympia");

    const tournamentId = formData.get("tournamentId") as string;

    if (!tournamentId || !tournamentId.match(/^[0-9a-f\-]+$/i)) {
      return { error: "ID giải không hợp lệ." };
    }

    const { error } = await olympia.from("tournaments").delete().eq("id", tournamentId);

    if (error) return { error: error.message };

    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    return { success: "Đã xóa giải đấu thành công." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể xóa giải đấu." };
  }
}
