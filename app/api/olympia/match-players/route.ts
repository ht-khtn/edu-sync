import { resolveDisplayNamesForUserIds } from "@/lib/olympia-display-names";
import { getServerAuthContext } from "@/lib/server-auth";
import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const bodySchema = z.object({
  matchId: z.string().min(1, "Thiếu matchId"),
  participantId: z.string().uuid("Thí sinh không hợp lệ"),
  seatIndex: z.coerce.number().int().min(1).max(4),
});

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveMatchId(olympia: SupabaseClient, raw: string): Promise<string | null> {
  // raw có thể là match UUID, live_sessions.id hoặc join_code.
  if (isUuid(raw)) {
    const { data: matchDirect, error: matchDirectError } = await olympia
      .from("matches")
      .select("id")
      .eq("id", raw)
      .maybeSingle();
    if (matchDirectError) throw matchDirectError;
    if (matchDirect?.id) return matchDirect.id;

    const { data: sessionByIdOrJoin, error: sessionByIdOrJoinError } = await olympia
      .from("live_sessions")
      .select("match_id")
      .or(`id.eq.${raw},join_code.eq.${raw}`)
      .maybeSingle();
    if (sessionByIdOrJoinError) throw sessionByIdOrJoinError;
    return (sessionByIdOrJoin as { match_id?: string | null } | null)?.match_id ?? null;
  }

  const { data: sessionByJoin, error: sessionByJoinError } = await olympia
    .from("live_sessions")
    .select("match_id")
    .eq("join_code", raw)
    .maybeSingle();
  if (sessionByJoinError) throw sessionByJoinError;
  return (sessionByJoin as { match_id?: string | null } | null)?.match_id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const rawBody: unknown = await request.json();
    const parsedBody = bodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const { matchId: matchIdRaw, participantId, seatIndex } = parsedBody.data;
    const matchId = await resolveMatchId(olympia, matchIdRaw);
    if (!matchId) {
      return NextResponse.json(
        { error: "Không tìm thấy trận (matchId/join_code không hợp lệ)" },
        { status: 404 }
      );
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

    // participants trong schema hiện tại không có display_name; luôn resolve từ public.user_profiles/users.
    const nameMap = await resolveDisplayNamesForUserIds(supabase, [participantId]);
    const resolvedDisplayName = nameMap.get(participantId) ?? null;

    // Insert new match_player với display_name đã resolve
    const { data, error } = await olympia
      .from("match_players")
      .insert({
        match_id: matchId,
        participant_id: participantId,
        seat_index: seatIndex,
        display_name: resolvedDisplayName,
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
