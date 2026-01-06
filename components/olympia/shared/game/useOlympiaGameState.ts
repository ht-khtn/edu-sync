/*
 * Game session hook responsible for syncing live session state.
 * TODO: replace basic polling fallback with dedicated edge channel for lower latency events.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import getSupabase from "@/lib/supabase";
import type {
  AnswerRow,
  BuzzerEventRow,
  GameSessionPayload,
  ObstacleGuessRow,
  ObstacleRow,
  ObstacleTileRow,
  RoundQuestionRow,
  ScoreRow,
  StarUseRow,
} from "@/types/olympia/game";

type UseOlympiaGameStateArgs = {
  sessionId: string;
  initialData: GameSessionPayload;
};

type TimerSnapshot = {
  deadline: string | null;
  remainingMs: number | null;
  isExpired: boolean;
};

type BuzzerEvent = BuzzerEventRow & {
  payload?: Record<string, unknown> | null;
};

const computeRemaining = (deadline: string | null): TimerSnapshot => {
  if (!deadline) return { deadline: null, remainingMs: null, isExpired: false };
  const target = new Date(deadline).getTime();
  const now = Date.now();
  const remaining = target - now;
  return {
    deadline,
    remainingMs: remaining > 0 ? remaining : 0,
    isExpired: remaining <= 0,
  };
};

export function useOlympiaGameState({ sessionId, initialData }: UseOlympiaGameStateArgs) {
  const router = useRouter();
  const [session, setSession] = useState(initialData.session);
  const [scores, setScores] = useState(initialData.scores);
  const [roundQuestions, setRoundQuestions] = useState(initialData.roundQuestions);
  const [answers, setAnswers] = useState<AnswerRow[]>(initialData.answers ?? []);
  const [starUses, setStarUses] = useState<StarUseRow[]>(initialData.starUses ?? []);
  const [players] = useState(initialData.players);
  const [buzzerEvents, setBuzzerEvents] = useState<BuzzerEvent[]>(initialData.buzzerEvents ?? []);
  const [obstacle, setObstacle] = useState<ObstacleRow | null>(initialData.obstacle ?? null);
  const [obstacleTiles, setObstacleTiles] = useState<ObstacleTileRow[]>(
    initialData.obstacleTiles ?? []
  );
  const [obstacleGuesses, setObstacleGuesses] = useState<ObstacleGuessRow[]>(
    initialData.obstacleGuesses ?? []
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isRealtimeReady, setRealtimeReady] = useState(false);
  const [timer, setTimer] = useState<TimerSnapshot>(() =>
    computeRemaining(initialData.session.timer_deadline)
  );
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<Awaited<ReturnType<typeof getSupabase>> | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const pollInFlightRef = useRef(false);
  const sessionRef = useRef(initialData.session);
  const obstacleIdRef = useRef<string | null>(initialData.obstacle?.id ?? null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    obstacleIdRef.current = obstacle?.id ?? null;
  }, [obstacle?.id]);

  const questionState = session.question_state ?? "hidden";
  const roundType = session.current_round_type ?? "unknown";
  const matchId = initialData.match.id;

  // Khi router.refresh() hoặc server re-render truyền xuống initialData mới,
  // hook phải đồng bộ lại state. Nếu không, UI sẽ chỉ cập nhật khi F5 (reload).
  useEffect(() => {
    queueMicrotask(() => {
      setSession(initialData.session);
      setScores(initialData.scores ?? []);
      setRoundQuestions(initialData.roundQuestions ?? []);
      setAnswers((initialData.answers ?? []) as AnswerRow[]);
      setStarUses((initialData.starUses ?? []) as StarUseRow[]);
      setBuzzerEvents((initialData.buzzerEvents ?? []) as BuzzerEvent[]);
      setObstacle((initialData.obstacle ?? null) as ObstacleRow | null);
      setObstacleTiles((initialData.obstacleTiles ?? []) as ObstacleTileRow[]);
      setObstacleGuesses((initialData.obstacleGuesses ?? []) as ObstacleGuessRow[]);
      setTimer(computeRemaining(initialData.session.timer_deadline));
    });
  }, [initialData]);

  const fetchAnswersForQuestion = useCallback(async (roundQuestionId: string) => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    try {
      const olympia = supabase.schema("olympia");
      const { data, error } = await olympia
        .from("answers")
        .select(
          "id, match_id, match_round_id, round_question_id, player_id, answer_text, is_correct, points_awarded, response_time_ms, submitted_at"
        )
        .eq("round_question_id", roundQuestionId)
        .order("submitted_at", { ascending: false })
        .limit(20);
      if (error) {
        console.warn("[Olympia] fetch answers failed", error.message);
        return;
      }
      setAnswers((data as AnswerRow[] | null) ?? []);
    } catch (err) {
      console.warn("[Olympia] fetch answers failed", err);
    }
  }, []);

  const refreshFromServer = useCallback(() => {
    setStatusMessage("Đang đồng bộ dữ liệu mới…");
    router.refresh();
  }, [router]);

  const pollSnapshot = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    if (typeof document !== "undefined" && document.hidden) return;
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;

    try {
      const olympia = supabase.schema("olympia");

      const { data: nextSession, error: sessionError } = await olympia
        .from("live_sessions")
        .select(
          "id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline, requires_player_password, buzzer_enabled, show_scoreboard_overlay, guest_media_control"
        )
        .eq("id", sessionId)
        .maybeSingle();

      if (sessionError) {
        setStatusMessage("Không thể đồng bộ realtime · đang thử lại…");
        return;
      }

      if (nextSession) {
        setSession((prev) => ({ ...prev, ...(nextSession as typeof prev) }));
      }

      const { data: nextScores, error: scoresError } = await olympia
        .from("match_scores")
        .select("id, match_id, player_id, round_type, points")
        .eq("match_id", matchId);
      if (!scoresError && nextScores) {
        setScores(nextScores as ScoreRow[]);
      }

      const currentRqId = (nextSession?.current_round_question_id ??
        sessionRef.current.current_round_question_id) as string | null | undefined;

      if (currentRqId) {
        const [{ data: rqRow }, { data: buzzerRows }] = await Promise.all([
          olympia
            .from("round_questions")
            .select(
              "id, match_round_id, question_id, question_set_item_id, order_index, target_player_id, meta, question_text, answer_text, note, questions(id, code, category, question_text, answer_text, note, image_url, audio_url), question_set_items(id, code, category, question_text, answer_text, note, image_url, audio_url)"
            )
            .eq("id", currentRqId)
            .maybeSingle(),
          olympia
            .from("buzzer_events")
            .select("id, match_id, round_question_id, player_id, event_type, result, occurred_at")
            .eq("round_question_id", currentRqId)
            .order("occurred_at", { ascending: false })
            .limit(20),
        ]);

        if (rqRow) {
          setRoundQuestions((prev) => {
            const next = [...prev];
            const idx = next.findIndex((row) => row.id === rqRow.id);
            if (idx === -1) next.push(rqRow as unknown as RoundQuestionRow);
            else next[idx] = { ...next[idx], ...(rqRow as unknown as RoundQuestionRow) };
            return next;
          });
        }

        if (buzzerRows) {
          setBuzzerEvents((buzzerRows as BuzzerEvent[]).slice(0, 20));
        }

        void fetchAnswersForQuestion(currentRqId);
      }

      // Star uses chủ yếu dùng cho vòng về đích.
      const { data: nextStarUses } = await olympia
        .from("star_uses")
        .select("id, match_id, round_question_id, player_id, outcome, declared_at")
        .eq("match_id", matchId);
      if (nextStarUses) {
        setStarUses(nextStarUses as StarUseRow[]);
      }

      setStatusMessage(null);
    } catch (err) {
      console.warn("[Olympia] poll snapshot failed", err);
      setStatusMessage("Không thể đồng bộ realtime · đang thử lại…");
    } finally {
      pollInFlightRef.current = false;
    }
  }, [fetchAnswersForQuestion, matchId, sessionId]);

  // Khi host đổi vòng/đổi câu: gọi poll ngay để tránh trường hợp realtime chậm/mất event.
  useEffect(() => {
    if (!session.current_round_id && !session.current_round_question_id) return;
    // Tránh spam: chỉ poll khi đã có supabase client.
    if (!supabaseRef.current) return;
    void pollSnapshot();
  }, [pollSnapshot, session.current_round_id, session.current_round_question_id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      setTimer(computeRemaining(session.timer_deadline));
    };
    const rafId = window.requestAnimationFrame(update);
    const intervalId = window.setInterval(update, 500);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
    };
  }, [session.timer_deadline]);

  useEffect(() => {
    let mounted = true;

    const clearRetryTimer = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const subscribe = async () => {
      try {
        const supabase = await getSupabase();
        if (!mounted) return;
        supabaseRef.current = supabase;

        clearRetryTimer();
        // Đảm bảo không giữ channel cũ khi subscribe lại.
        if (channelRef.current) {
          try {
            supabase.removeChannel(channelRef.current);
          } catch {
            channelRef.current.unsubscribe();
          }
          channelRef.current = null;
        }

        const channel = supabase
          .channel(`olympia-game-${sessionId}`)
          // NOTE: live_sessions drives question_state + timer.
          .on(
            "postgres_changes",
            { event: "*", schema: "olympia", table: "live_sessions", filter: `id=eq.${sessionId}` },
            (payload) => {
              if (payload.new) {
                setSession((prev) => ({ ...prev, ...(payload.new as typeof prev) }));
              }
            }
          )
          // Round questions update when host selects a question (TODO: highlight active question path animation).
          .on(
            "postgres_changes",
            { event: "*", schema: "olympia", table: "round_questions" },
            (payload) => {
              const nextQuestion = payload.new as RoundQuestionRow | null;
              if (!nextQuestion) return;
              const joinMatchId = Array.isArray(nextQuestion.match_rounds)
                ? nextQuestion.match_rounds[0]?.match_id
                : nextQuestion.match_rounds?.match_id;
              const eventMatchId = joinMatchId ?? matchId;
              if (eventMatchId !== matchId) return;
              setRoundQuestions((prev) => {
                const next = [...prev];
                const idx = next.findIndex((row) => row.id === nextQuestion.id);
                if (idx === -1) {
                  next.push(nextQuestion);
                } else {
                  next[idx] = { ...next[idx], ...nextQuestion };
                }
                return next;
              });
            }
          )
          // Scores reflect adjudication server-side.
          .on(
            "postgres_changes",
            { event: "*", schema: "olympia", table: "match_scores" },
            (payload) => {
              const nextScore = payload.new as ScoreRow | null;
              if (!nextScore) return;
              if ((nextScore.match_id ?? matchId) !== matchId) return;
              setScores((prev) => {
                const next = [...prev];
                const resolveId = (row: ScoreRow) => row.id ?? `player:${row.player_id}`;
                const candidateId = resolveId(nextScore);
                const idx = next.findIndex((row) => resolveId(row) === candidateId);
                if (idx === -1) {
                  next.push(nextScore);
                } else {
                  next[idx] = { ...next[idx], ...nextScore };
                }
                return next;
              });
            }
          )
          // Về đích: theo dõi Star (upsert/delete).
          .on(
            "postgres_changes",
            { event: "*", schema: "olympia", table: "star_uses" },
            (payload) => {
              const row = (payload.new ?? payload.old) as StarUseRow | null;
              if (!row) return;
              if ((row.match_id ?? matchId) !== matchId) return;

              const isDelete =
                (payload as { eventType?: string }).eventType === "DELETE" || !payload.new;
              setStarUses((prev) => {
                const idx = prev.findIndex(
                  (s) =>
                    s.id === row.id ||
                    (s.round_question_id === row.round_question_id && s.player_id === row.player_id)
                );
                if (isDelete) {
                  if (idx === -1) return prev;
                  const next = [...prev];
                  next.splice(idx, 1);
                  return next;
                }

                if (idx === -1) return [row, ...prev];
                const next = [...prev];
                next[idx] = { ...next[idx], ...row };
                return next;
              });
            }
          )
          // TODO: render buzzer feed with animations once UI finalized.
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "olympia", table: "buzzer_events" },
            (payload) => {
              const eventRow = payload.new as BuzzerEvent | null;
              if (!eventRow) return;
              if ((eventRow.match_id ?? matchId) !== matchId) return;
              setBuzzerEvents((prev) => [eventRow, ...prev].slice(0, 20));
            }
          )
          // Đáp án thí sinh (MC/host view dùng để theo dõi realtime)
          .on(
            "postgres_changes",
            { event: "*", schema: "olympia", table: "answers" },
            (payload) => {
              const row = (payload.new ?? payload.old) as AnswerRow | null;
              if (!row) return;

              // Nếu row có match_id thì filter chặt; nếu không có (tuỳ schema), fallback không filter.
              if (row.match_id && row.match_id !== matchId) return;

              const currentRqId = sessionRef.current.current_round_question_id;
              if (!currentRqId) return;
              if (row.round_question_id !== currentRqId) return;

              const isDelete =
                (payload as { eventType?: string }).eventType === "DELETE" || !payload.new;
              setAnswers((prev) => {
                if (isDelete) {
                  return prev.filter((a) => a.id !== row.id);
                }

                const next = [row, ...prev.filter((a) => a.id !== row.id)];
                const parsed = next
                  .slice()
                  .sort((a, b) => {
                    const at = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
                    const bt = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
                    return bt - at;
                  })
                  .slice(0, 20);
                return parsed;
              });
            }
          )
          // CNV: nghe obstacle + tile + guess để render board tối thiểu.
          .on(
            "postgres_changes",
            { event: "*", schema: "olympia", table: "obstacles" },
            (payload) => {
              const row = payload.new as ObstacleRow | null;
              if (!row) return;
              const currentRoundId = sessionRef.current.current_round_id;
              if (!currentRoundId) return;
              if (row.match_round_id !== currentRoundId) return;
              setObstacle(row);
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "olympia", table: "obstacle_tiles" },
            (payload) => {
              const row = payload.new as ObstacleTileRow | null;
              if (!row) return;
              const obstacleId = obstacleIdRef.current;
              if (!obstacleId) return;
              if (row.obstacle_id !== obstacleId) return;
              setObstacleTiles((prev) => {
                const next = [...prev];
                const idx = next.findIndex((t) => t.id === row.id);
                if (idx === -1) next.push(row);
                else next[idx] = { ...next[idx], ...row };
                return next.sort((a, b) => a.position_index - b.position_index);
              });
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "olympia", table: "obstacle_guesses" },
            (payload) => {
              const row = payload.new as ObstacleGuessRow | null;
              if (!row) return;
              const obstacleId = obstacleIdRef.current;
              if (!obstacleId) return;
              if (row.obstacle_id !== obstacleId) return;
              setObstacleGuesses((prev) => [row, ...prev].slice(0, 20));
            }
          );

        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setRealtimeReady(true);
            setStatusMessage(null);
            retryCountRef.current = 0;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setRealtimeReady(false);

            const nextCount = Math.min(retryCountRef.current + 1, 6);
            retryCountRef.current = nextCount;
            const delayMs = Math.min(10000, 500 * Math.pow(2, nextCount));
            console.warn("[Olympia] realtime channel status", status, "retry in", delayMs, "ms");
            setStatusMessage("Mất kết nối realtime · đang thử lại…");

            clearRetryTimer();
            retryTimerRef.current = setTimeout(() => {
              if (!mounted) return;
              void subscribe();
            }, delayMs);
          }
        });

        channelRef.current = channel;
      } catch (error) {
        console.error("Olympia game realtime init failed", error);
        setStatusMessage("Không thể kết nối realtime");
      }
    };

    subscribe();

    // Fallback polling: đảm bảo mọi thay đổi (điểm/câu hỏi/màn chờ) cập nhật dù realtime bị chặn bởi auth/RLS.
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    pollingRef.current = setInterval(() => {
      void pollSnapshot();
    }, 1500);

    return () => {
      mounted = false;
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (channelRef.current && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
      } else if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [sessionId, matchId, pollSnapshot]);

  // Khi host chuyển câu, load lại danh sách đáp án hiện tại (không reload trang).
  useEffect(() => {
    const rqId = session.current_round_question_id;
    if (!rqId) {
      // Tránh setState đồng bộ trong effect (eslint react-hooks/set-state-in-effect)
      queueMicrotask(() => setAnswers([]));
      return;
    }
    // Tránh gọi hàm có setState trực tiếp trong body effect (eslint react-hooks/set-state-in-effect)
    queueMicrotask(() => {
      void fetchAnswersForQuestion(rqId);
    });
  }, [session.current_round_question_id, fetchAnswersForQuestion]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      if (document.hidden) return;
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
      cleanupTimerRef.current = setTimeout(() => {
        refreshFromServer();
      }, 120000);
    };
    document.addEventListener("visibilitychange", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
    };
  }, [refreshFromServer]);

  const timerLabel = useMemo(() => {
    if (timer.remainingMs === null) return "Đang chờ host";
    const totalSeconds = Math.max(0, Math.floor(timer.remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, [timer.remainingMs]);

  return {
    match: initialData.match,
    session,
    players,
    scores,
    roundQuestions,
    buzzerEvents,
    answers,
    starUses,
    obstacle,
    obstacleTiles,
    obstacleGuesses,
    timer,
    timerLabel,
    questionState,
    roundType,
    statusMessage,
    isRealtimeReady,
    viewerUserId: initialData.viewerUserId,
    refreshFromServer,
  };
}
