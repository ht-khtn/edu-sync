import { getServerAuthContext } from "@/lib/server-auth";
import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const { matchId, participantId, seatIndex } = await request.json();

    if (!matchId || !participantId || !seatIndex) {
      return NextResponse.json({ error: "Thiếu thông tin cần thiết" }, { status: 400 });
    }

    if (seatIndex < 1 || seatIndex > 4) {
      return NextResponse.json({ error: "Ghế phải nằm trong khoảng 1-4" }, { status: 400 });
    }

    // Check if seat is already occupied
    const { data: existingPlayer } = await olympia
      .from("match_players")
      .select("id")
      .eq("match_id", matchId)
      .eq("seat_index", seatIndex)
      .maybeSingle();

    if (existingPlayer) {
      return NextResponse.json({ error: `Ghế ${seatIndex} đã có thí sinh` }, { status: 409 });
    }

    // Check if participant is already in match
    const { data: existingAssignment } = await olympia
      .from("match_players")
      .select("id")
      .eq("match_id", matchId)
      .eq("participant_id", participantId)
      .maybeSingle();

    if (existingAssignment) {
      return NextResponse.json({ error: "Thí sinh này đã được gán vào trận" }, { status: 409 });
    }

    // Insert new match_player
    const { data, error } = await olympia
      .from("match_players")
      .insert({
        match_id: matchId,
        participant_id: participantId,
        seat_index: seatIndex,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error("[POST /api/olympia/match-players]", error);
      return NextResponse.json(
        { error: error.message || "Không thể thêm thí sinh" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[POST /api/olympia/match-players]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi server" },
      { status: 500 }
    );
  }
}
