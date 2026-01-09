import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";

type SnapshotRoundQuestion = {
  id: string;
  target_player_id: string | null;
  meta: Record<string, unknown> | null;
};

type SnapshotAnswer = {
  id: string;
  player_id: string;
  answer_text: string | null;
  is_correct: boolean | null;
  points_awarded: number | null;
  submitted_at: string;
};

type SnapshotResponse = {
  currentRoundQuestionId: string | null;
  questionState: string | null;
  winnerPlayerId: string | null;
  roundQuestion: SnapshotRoundQuestion | null;
  answers: SnapshotAnswer[];
};

type LiveSessionRow = {
  current_round_question_id: string | null;
  question_state: string | null;
};

type BuzzerResetRow = { occurred_at: string | null };

type BuzzerWinnerRow = {
  id: string;
  player_id: string | null;
  occurred_at: string | null;
  event_type: string | null;
  result: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { supabase, appUserId } = await getServerAuthContext();
    if (!appUserId) {
      return NextResponse.json({ error: "FORBIDDEN_OLYMPIA_ADMIN" }, { status: 403 });
    }
    const olympia = supabase.schema("olympia");

    const { data: participant, error: participantErr } = await olympia
      .from("participants")
      .select("role")
      .eq("user_id", appUserId)
      .maybeSingle();

    if (participantErr) {
      return NextResponse.json({ error: participantErr.message }, { status: 500 });
    }
    if (!participant || participant.role !== "AD") {
      return NextResponse.json({ error: "FORBIDDEN_OLYMPIA_ADMIN" }, { status: 403 });
    }

    const url = new URL(request.url);
    const matchId = url.searchParams.get("matchId");
    const sessionId = url.searchParams.get("sessionId");

    if (!matchId) {
      return NextResponse.json({ error: "Thiếu matchId." }, { status: 400 });
    }

    let currentRoundQuestionId: string | null = null;
    let questionState: string | null = null;

    if (sessionId) {
      const { data: sessionRow, error: sessionErr } = await olympia
        .from("live_sessions")
        .select("current_round_question_id, question_state")
        .eq("id", sessionId)
        .maybeSingle();

      if (sessionErr) {
        return NextResponse.json({ error: sessionErr.message }, { status: 500 });
      }

      const typed = (sessionRow as LiveSessionRow | null) ?? null;
      currentRoundQuestionId = typed?.current_round_question_id ?? null;
      questionState = typed?.question_state ?? null;
    }

    // Fallback: nếu không có sessionId thì không biết active câu nào.
    if (!currentRoundQuestionId) {
      const empty: SnapshotResponse = {
        currentRoundQuestionId: null,
        questionState,
        winnerPlayerId: null,
        roundQuestion: null,
        answers: [],
      };
      return NextResponse.json(empty, { status: 200 });
    }

    const rqId = currentRoundQuestionId;

    const [{ data: answers, error: answersErr }, { data: rq, error: rqErr }] = await Promise.all([
      olympia
        .from("answers")
        .select("id, player_id, answer_text, is_correct, points_awarded, submitted_at")
        .eq("match_id", matchId)
        .eq("round_question_id", rqId)
        .order("submitted_at", { ascending: false })
        .limit(50),
      olympia
        .from("round_questions")
        .select("id, target_player_id, meta")
        .eq("id", rqId)
        .maybeSingle(),
    ]);

    if (answersErr) {
      return NextResponse.json({ error: answersErr.message }, { status: 500 });
    }
    if (rqErr) {
      return NextResponse.json({ error: rqErr.message }, { status: 500 });
    }

    const { data: lastReset, error: resetErr } = await olympia
      .from("buzzer_events")
      .select("occurred_at")
      .eq("match_id", matchId)
      .eq("round_question_id", rqId)
      .eq("event_type", "reset")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (resetErr) {
      return NextResponse.json({ error: resetErr.message }, { status: 500 });
    }

    const resetOccurredAt = ((lastReset as BuzzerResetRow | null) ?? null)?.occurred_at ?? null;

    let winnerPlayerId: string | null = null;
    {
      let winnerQuery = olympia
        .from("buzzer_events")
        .select("id, player_id, occurred_at, event_type, result")
        .eq("match_id", matchId)
        .eq("round_question_id", rqId)
        .in("event_type", ["buzz", "steal"])
        .eq("result", "win");

      if (resetOccurredAt) winnerQuery = winnerQuery.gte("occurred_at", resetOccurredAt);

      const { data: winner, error: winnerErr } = await winnerQuery
        .order("occurred_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (winnerErr) {
        return NextResponse.json({ error: winnerErr.message }, { status: 500 });
      }

      winnerPlayerId = ((winner as BuzzerWinnerRow | null) ?? null)?.player_id ?? null;
    }

    const response: SnapshotResponse = {
      currentRoundQuestionId,
      questionState,
      winnerPlayerId,
      roundQuestion: rq
        ? {
            id: (rq as SnapshotRoundQuestion).id,
            target_player_id: (rq as SnapshotRoundQuestion).target_player_id ?? null,
            meta: (rq as SnapshotRoundQuestion).meta ?? null,
          }
        : null,
      answers: (answers as SnapshotAnswer[] | null) ?? [],
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không thể lấy snapshot host.";
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
