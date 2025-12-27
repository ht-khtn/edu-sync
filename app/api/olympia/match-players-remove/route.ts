import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";
import { getServerSupabase } from "@/lib/server-auth";

export async function DELETE(request: Request) {
  try {
    await ensureOlympiaAdminAccess();

    const { searchParams } = new URL(request.url);
    const matchPlayerId = searchParams.get("id");

    if (!matchPlayerId) {
      return Response.json({ error: "Vui lòng cung cấp ID của match_players" }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const olympia = supabase.schema("olympia");

    // Delete the match_player record
    const { error: deleteError } = await olympia
      .from("match_players")
      .delete()
      .eq("id", matchPlayerId);

    if (deleteError) {
      console.error("[RemoveMatchPlayer]", deleteError);
      return Response.json(
        { error: deleteError.message || "Không thể xóa thí sinh" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[RemoveMatchPlayer]", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ" },
      { status: 500 }
    );
  }
}
