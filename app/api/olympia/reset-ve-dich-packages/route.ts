import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";
import { getServerSupabase } from "@/lib/server-auth";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  try {
    await ensureOlympiaAdminAccess();
    const supabase = await getServerSupabase();
    const olympia = supabase.schema("olympia");

    const formData = await request.formData();
    const matchId = formData.get("matchId");

    if (!matchId || typeof matchId !== "string") {
      return Response.json({ error: "Thiếu matchId" }, { status: 400 });
    }

    // Get live session
    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status, match_id, current_round_type, current_round_id")
      .eq("match_id", matchId)
      .eq("status", "running")
      .maybeSingle();

    if (sessionError) {
      return Response.json({ error: sessionError.message }, { status: 400 });
    }

    if (!session) {
      return Response.json({ error: "Trận chưa mở phòng live (running)." }, { status: 400 });
    }

    if (session.current_round_type !== "ve_dich") {
      return Response.json({ error: "Hiện không ở vòng Về đích." }, { status: 400 });
    }

    if (!session.current_round_id) {
      return Response.json({ error: "Chưa có round Về đích hiện tại." }, { status: 400 });
    }

    // Get all round_questions for this round
    const { data: allRqs, error: rqsErr } = await olympia
      .from("round_questions")
      .select("id, meta")
      .eq("match_round_id", session.current_round_id);

    if (rqsErr) {
      return Response.json({ error: rqsErr.message }, { status: 400 });
    }

    // Reset all round_questions
    const updates = (allRqs ?? []).map((rq) => {
      const meta = (rq as unknown as { meta?: unknown }).meta;
      const metaObj = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
      const nextMeta = { ...metaObj };
      delete nextMeta.ve_dich_value;
      // Giữ lại code (để hiện thị câu hỏi), chỉ xóa ve_dich_value

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

    if (firstError) {
      return Response.json({ error: firstError.message }, { status: 400 });
    }

    // Revalidate paths
    revalidatePath("/olympia/client");
    revalidatePath(`/olympia/client/game`);
    revalidatePath(`/olympia/client/guest`);
    revalidatePath("/olympia");

    return Response.json({ success: "Đã reset gói Về đích cho tất cả thí sinh." });
  } catch (error) {
    console.error("[ResetVeDichPackages]", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ" },
      { status: 500 }
    );
  }
}
