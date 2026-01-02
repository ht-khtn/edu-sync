"use server";

import { getServerAuthContext } from "@/lib/server-auth";
import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";
import { revalidatePath } from "next/cache";

export type DeleteQuestionSetState = { error: string | null; success: string | null };

export type QuestionSetItem = {
  id: string;
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

export async function getQuestionSetItems(questionSetId: string): Promise<QuestionSetItem[]> {
  try {
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const { data, error } = await olympia
      .from("question_set_items")
      .select(
        "id, code, category, question_text, answer_text, note, submitted_by, source, image_url, audio_url, order_index"
      )
      .eq("question_set_id", questionSetId)
      .order("order_index", { ascending: true });

    if (error) {
      console.error("[getQuestionSetItems] Error:", error);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("[getQuestionSetItems] Exception:", err);
    return [];
  }
}

export async function deleteQuestionSetAction(
  _: DeleteQuestionSetState,
  formData: FormData
): Promise<DeleteQuestionSetState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const questionSetId = String(formData.get("questionSetId") ?? "").trim();
    if (!questionSetId) return { error: "Thiếu questionSetId.", success: null };

    // Nếu bộ đề đã được gán vào trận và tạo round_questions, FK sẽ chặn xoá.
    // Chủ động kiểm tra để trả thông báo dễ hiểu.
    const { data: itemRows, error: itemsError } = await olympia
      .from("question_set_items")
      .select("id")
      .eq("question_set_id", questionSetId)
      .limit(5000);

    if (itemsError) return { error: itemsError.message, success: null };

    const itemIds = (itemRows ?? []).map((r) => r.id).filter(Boolean);
    if (itemIds.length > 0) {
      const { data: usedRows, error: usedError } = await olympia
        .from("round_questions")
        .select("id")
        .in("question_set_item_id", itemIds)
        .limit(1);

      if (usedError) return { error: usedError.message, success: null };
      if ((usedRows?.length ?? 0) > 0) {
        return {
          error: "Không thể xoá bộ đề vì đã được sử dụng trong một trận (round_questions).",
          success: null,
        };
      }
    }

    const { error: deleteError } = await olympia
      .from("question_sets")
      .delete()
      .eq("id", questionSetId);
    if (deleteError) return { error: deleteError.message, success: null };

    revalidatePath("/olympia/admin/question-bank");
    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");

    return { error: null, success: "Đã xoá bộ đề." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể xoá bộ đề.", success: null };
  }
}
