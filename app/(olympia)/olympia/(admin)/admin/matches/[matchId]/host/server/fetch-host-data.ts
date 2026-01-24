import { getServerAuthContext } from "@/lib/server-auth";
import { resolveDisplayNamesForUserIds } from "@/lib/olympia-display-names";

import { getRoundQuestionsForMatchCached } from "./round-questions-cache";
import {
  OLYMPIA_HOST_PERF_TRACE,
  OLYMPIA_HOST_SLOW_LOG_MS,
  measure,
  nowMs,
  perfTime,
} from "./perf";
import { isUuid } from "./utils";
import type {
  CachedRoundQuestionRow,
  HostData,
  HostObstacleGuessRow,
  HostObstacleRow,
  HostObstacleTileRow,
  RecentAnswerRow,
  RecentBuzzRow,
  ScoreChangeRow,
  WinnerBuzzRow,
  VcnvAnswerSummaryRow,
} from "./types";

export async function fetchHostData(matchCode: string): Promise<HostData | null> {
  const perf: Array<{ label: string; ms: number }> = [];
  const startedAt = nowMs();

  const { supabase, authUid, appUserId } = await perfTime("[perf][host] getServerAuthContext", () =>
    measure(perf, "getServerAuthContext", () => getServerAuthContext())
  );
  const olympia = supabase.schema("olympia");

  if (OLYMPIA_HOST_PERF_TRACE) {
    console.info("[perf][host] request context", {
      matchCode,
      isUuid: isUuid(matchCode),
      hasAuthUid: Boolean(authUid),
      hasAppUserId: Boolean(appUserId),
    });
  }

  // Route param historically is match UUID, nhưng user cũng hay copy/paste join_code.
  // Hỗ trợ cả 2 để tránh 404.
  let realMatchId: string | null = null;
  let preloadedMatch: { id: string; name: string; status: string } | null = null;

  // 1) Nếu là UUID: ưu tiên coi là matchId, nhưng fallback nếu thực tế là sessionId.
  if (isUuid(matchCode)) {
    const { data: matchDirect, error: matchDirectError } = await perfTime(
      `[perf][host] supabase.matches.byId ${matchCode}`,
      () => olympia.from("matches").select("id, name, status").eq("id", matchCode).maybeSingle()
    );
    if (matchDirectError) throw matchDirectError;
    if (matchDirect) {
      realMatchId = matchDirect.id;
      preloadedMatch = matchDirect;
      if (OLYMPIA_HOST_PERF_TRACE)
        console.info("[perf][host] resolved matchDirect", { realMatchId });
    } else {
      // Fallback: treat UUID as live_sessions.id (nhiều người copy nhầm), hoặc join_code (trường hợp join_code dạng UUID).
      const { data: sessionByIdOrJoin, error: sessionByIdOrJoinError } = await perfTime(
        `[perf][host] supabase.live_sessions.byIdOrJoin ${matchCode}`,
        () =>
          olympia
            .from("live_sessions")
            .select("match_id")
            .or(`id.eq.${matchCode},join_code.eq.${matchCode}`)
            .maybeSingle()
      );
      if (sessionByIdOrJoinError) throw sessionByIdOrJoinError;
      realMatchId = sessionByIdOrJoin?.match_id ?? null;
      if (OLYMPIA_HOST_PERF_TRACE)
        console.info("[perf][host] resolved from session fallback", { realMatchId });
    }
  } else {
    // 2) Nếu không phải UUID: coi là join_code.
    const { data: sessionByJoin, error: sessionByJoinError } = await perfTime(
      `[perf][host] supabase.live_sessions.byJoinCode ${matchCode}`,
      () =>
        olympia.from("live_sessions").select("match_id").eq("join_code", matchCode).maybeSingle()
    );
    if (sessionByJoinError) throw sessionByJoinError;
    realMatchId = sessionByJoin?.match_id ?? null;
    if (OLYMPIA_HOST_PERF_TRACE)
      console.info("[perf][host] resolved from join_code", { realMatchId });
  }

  if (!realMatchId) {
    if (OLYMPIA_HOST_PERF_TRACE)
      console.warn("[perf][host] no realMatchId resolved; returning null");
    console.error("[host] Could not resolve match from matchCode:", matchCode);
    return null;
  }

  const match = await (async () => {
    if (preloadedMatch?.id === realMatchId) return preloadedMatch;
    const { data, error } = await perfTime(
      `[perf][host] supabase.matches.byId(realMatchId) ${realMatchId}`,
      () => olympia.from("matches").select("id, name, status").eq("id", realMatchId).maybeSingle()
    );
    if (error) throw error;
    return data;
  })();
  if (!match) {
    if (OLYMPIA_HOST_PERF_TRACE)
      console.warn("[perf][host] match not found; returning null", { realMatchId });
    return null;
  }

  const [
    { data: liveSession, error: liveError },
    { data: rounds, error: roundsError },
    { data: players, error: playersError },
    { data: scores, error: scoresError },
  ] = await Promise.all([
    perfTime(`[perf][host] supabase.live_sessions.byMatchId ${realMatchId}`, () =>
      olympia
        .from("live_sessions")
        .select(
          "id, match_id, status, join_code, question_state, current_round_type, current_round_id, current_round_question_id, timer_deadline, requires_player_password, buzzer_enabled, show_scoreboard_overlay, show_answers_overlay"
        )
        .eq("match_id", realMatchId)
        .maybeSingle()
    ),
    perfTime(`[perf][host] supabase.match_rounds.byMatchId ${realMatchId}`, () =>
      olympia
        .from("match_rounds")
        .select("id, round_type, order_index")
        .eq("match_id", realMatchId)
        .order("order_index", { ascending: true })
    ),
    perfTime(`[perf][host] supabase.match_players.byMatchId ${realMatchId}`, () =>
      olympia
        .from("match_players")
        .select("id, seat_index, display_name, participant_id, is_disqualified_obstacle")
        .eq("match_id", realMatchId)
        .order("seat_index", { ascending: true })
    ),
    perfTime(`[perf][host] supabase.match_scores.byMatchId ${realMatchId}`, () =>
      olympia.from("match_scores").select("id, player_id, points").eq("match_id", realMatchId)
    ),
  ]);

  if (liveError) throw liveError;
  if (roundsError) throw roundsError;
  if (playersError) console.warn("[Olympia] Failed to load match players:", playersError.message);
  if (scoresError) console.warn("[Olympia] Failed to load match scores:", scoresError.message);

  const participantIds = (players ?? [])
    .map((p) => (p as { participant_id?: string | null }).participant_id ?? null)
    .filter((id): id is string => Boolean(id));
  const resolvedNameMap = await perfTime(
    `[perf][host] resolveDisplayNamesForUserIds n=${participantIds.length}`,
    () => resolveDisplayNamesForUserIds(supabase, participantIds)
  );
  const normalizedPlayers = (players ?? []).map((p) => {
    const row = p as { participant_id?: string | null; display_name?: string | null };
    const pid = row.participant_id ?? null;
    const resolved = pid ? (resolvedNameMap.get(pid) ?? null) : null;
    return {
      ...p,
      display_name: row.display_name ?? resolved,
    };
  });

  const scoreLookup = new Map<string, number>();
  for (const s of scores ?? []) {
    const prev = scoreLookup.get(s.player_id) ?? 0;
    scoreLookup.set(s.player_id, prev + (s.points ?? 0));
  }

  const roundIds = (rounds ?? []).map((r) => r.id);
  const { data: roundQuestions } = await (async () => {
    if (roundIds.length === 0) return { data: [] as CachedRoundQuestionRow[] };

    // Dữ liệu round_questions gần như tĩnh; cache ngắn hạn để giảm re-render sau server action.
    // Khi OLYMPIA_PERF_TRACE=1 vẫn đo được tổng thời gian qua measure/perfTime.
    const cached = await perfTime(
      `[perf][host] cache.round_questions.byMatchId ${realMatchId}`,
      () =>
        measure(perf, "cache.round_questions.byMatchId", () =>
          getRoundQuestionsForMatchCached(realMatchId)
        )
    );
    return { data: cached };
  })();

  const currentQuestionId = liveSession?.current_round_question_id;

  const currentRoundQuestion = currentQuestionId
    ? (roundQuestions?.find((q) => q.id === currentQuestionId) ?? null)
    : null;

  const { data: lastReset } = currentQuestionId
    ? await perfTime(`[perf][host] supabase.buzzer_events.lastReset rq=${currentQuestionId}`, () =>
        olympia
          .from("buzzer_events")
          .select("occurred_at")
          .eq("round_question_id", currentQuestionId)
          .eq("event_type", "reset")
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    : { data: null };
  const resetOccurredAt =
    (lastReset as { occurred_at?: string | null } | null)?.occurred_at ?? null;

  type StarUseLookupRow = { id: string; round_question_id: string | null };
  const { data: starUseByPlayer } =
    currentQuestionId && currentRoundQuestion?.target_player_id
      ? await perfTime(`[perf][host] supabase.star_uses.byPlayer match=${realMatchId}`, () =>
          olympia
            .from("star_uses")
            .select("id, round_question_id")
            .eq("match_id", realMatchId)
            .eq("player_id", currentRoundQuestion.target_player_id)
            .order("declared_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        )
      : { data: null };

  const starUseRow = (starUseByPlayer as StarUseLookupRow | null) ?? null;
  const isStarLocked = Boolean(starUseRow?.id);
  const isStarEnabled = Boolean(
    currentQuestionId && starUseRow?.round_question_id === currentQuestionId
  );

  const [{ data: winnerBuzz }, { data: recentBuzzes }, { data: recentAnswers }] = await Promise.all(
    [
      currentQuestionId
        ? (() => {
            let query = olympia
              .from("buzzer_events")
              .select("id, player_id, result, occurred_at, match_players(seat_index, display_name)")
              .eq("round_question_id", currentQuestionId)
              .in("event_type", ["buzz", "steal"])
              .eq("result", "win");
            if (resetOccurredAt) query = query.gte("occurred_at", resetOccurredAt);
            return perfTime(
              `[perf][host] supabase.buzzer_events.winner rq=${currentQuestionId}`,
              () => query.order("occurred_at", { ascending: true }).limit(1).maybeSingle()
            );
          })()
        : Promise.resolve({ data: null }),
      currentQuestionId
        ? (() => {
            let query = olympia
              .from("buzzer_events")
              .select("id, player_id, result, occurred_at, match_players(seat_index, display_name)")
              .eq("round_question_id", currentQuestionId);
            if (resetOccurredAt) query = query.gte("occurred_at", resetOccurredAt);
            return perfTime(
              `[perf][host] supabase.buzzer_events.recent rq=${currentQuestionId}`,
              () => query.order("occurred_at", { ascending: false }).limit(10)
            );
          })()
        : Promise.resolve({ data: [] }),
      currentQuestionId
        ? perfTime(`[perf][host] supabase.answers.recent rq=${currentQuestionId}`, () =>
            olympia
              .from("answers")
              .select(
                "id, player_id, answer_text, is_correct, points_awarded, submitted_at, match_players(seat_index, display_name)"
              )
              .eq("round_question_id", currentQuestionId)
              .order("submitted_at", { ascending: false })
              .limit(10)
          )
        : Promise.resolve({ data: [] }),
    ]
  );

  let obstacle: HostObstacleRow | null = null;
  let obstacleTiles: HostObstacleTileRow[] = [];
  let obstacleGuesses: HostObstacleGuessRow[] = [];
  let vcnvAnswerSummary: VcnvAnswerSummaryRow[] = [];
  if (liveSession?.current_round_type === "vcnv" && liveSession.current_round_id) {
    const { data: obstacleRow } = await perfTime(
      `[perf][host] supabase.obstacles.byRoundId round=${liveSession.current_round_id}`,
      () =>
        olympia
          .from("obstacles")
          .select("id, match_round_id, title, image_url")
          .eq("match_round_id", liveSession.current_round_id)
          .maybeSingle()
    );
    obstacle = (obstacleRow as HostObstacleRow | null) ?? null;

    if (obstacle?.id) {
      const obstacleId = obstacle.id;
      const [{ data: tiles }, { data: guesses }] = await Promise.all([
        perfTime(`[perf][host] supabase.obstacle_tiles.byObstacle obstacle=${obstacleId}`, () =>
          olympia
            .from("obstacle_tiles")
            .select("id, round_question_id, position_index, is_open")
            .eq("obstacle_id", obstacleId)
            .order("position_index", { ascending: true })
        ),
        perfTime(`[perf][host] supabase.obstacle_guesses.byObstacle obstacle=${obstacleId}`, () =>
          olympia
            .from("obstacle_guesses")
            .select(
              "id, player_id, guess_text, is_correct, attempt_order, attempted_at, match_players(seat_index, display_name)"
            )
            .eq("obstacle_id", obstacleId)
            .order("attempted_at", { ascending: false })
            .limit(10)
        ),
      ]);
      obstacleTiles = (tiles as HostObstacleTileRow[] | null) ?? [];
      obstacleGuesses = (guesses as HostObstacleGuessRow[] | null) ?? [];

      const relatedRqIds = obstacleTiles
        .map((t) => t.round_question_id)
        .filter((id): id is string => Boolean(id));
      if (relatedRqIds.length > 0) {
        const { data: answerSummary } = await perfTime(
          `[perf][host] supabase.answers.vcnvSummary rqCount=${relatedRqIds.length}`,
          () =>
            olympia
              .from("answers")
              .select("id, round_question_id, is_correct")
              .eq("match_id", realMatchId)
              .in("round_question_id", relatedRqIds)
        );
        vcnvAnswerSummary = (answerSummary as unknown as VcnvAnswerSummaryRow[] | null) ?? [];
      }
    }
  }

  let scoreChanges: ScoreChangeRow[] = [];
  let scoreChangesError: string | null = null;
  const { data: scoreChangesData, error: scoreChangesErr } = await perfTime(
    `[perf][host] supabase.score_changes.recent match=${realMatchId}`,
    () =>
      olympia
        .from("score_changes")
        .select(
          "id, player_id, round_type, requested_delta, applied_delta, points_before, points_after, source, reason, created_at, revert_of, reverted_at, match_players(seat_index, display_name)"
        )
        .eq("match_id", realMatchId)
        .order("created_at", { ascending: false })
        .limit(10)
  );

  if (scoreChangesErr) {
    scoreChangesError = scoreChangesErr.message;
  } else {
    scoreChanges = (scoreChangesData as unknown as ScoreChangeRow[] | null) ?? [];
  }

  // Log chỉ khi chậm (hoặc khi bật trace).
  const totalMs = Math.round((nowMs() - startedAt) * 10) / 10;
  if (OLYMPIA_HOST_PERF_TRACE || totalMs >= OLYMPIA_HOST_SLOW_LOG_MS) {
    const top = [...perf].sort((a, b) => b.ms - a.ms).slice(0, 8);
    console.info("[Olympia][Slow] host/fetchHostData", {
      matchCode,
      realMatchId,
      totalMs,
      top,
    });
  }

  return {
    match,
    liveSession,
    rounds: (rounds ?? []) as unknown as HostData["rounds"],
    players: normalizedPlayers as HostData["players"],
    scoreRows: (scores ?? []) as HostData["scoreRows"],
    scores: (normalizedPlayers as HostData["players"]).map((p) => ({
      playerId: p.id,
      displayName: p.display_name ?? `Ghế ${p.seat_index}`,
      seatNumber: p.seat_index,
      totalScore: scoreLookup.get(p.id) ?? 0,
    })),
    roundQuestions: (roundQuestions ?? []) as CachedRoundQuestionRow[],
    currentRoundQuestion: (currentRoundQuestion as CachedRoundQuestionRow | null) ?? null,
    isStarEnabled,
    isStarLocked,
    winnerBuzz: (winnerBuzz as WinnerBuzzRow | null) ?? null,
    recentBuzzes: (recentBuzzes as RecentBuzzRow[]) ?? [],
    recentAnswers: (recentAnswers as RecentAnswerRow[]) ?? [],
    scoreChanges,
    scoreChangesError,
    obstacle,
    obstacleTiles,
    obstacleGuesses,
    vcnvAnswerSummary,
  };
}
