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
  BuzzerEventRow,
  GameSessionPayload,
  ObstacleGuessRow,
  ObstacleRow,
  ObstacleTileRow,
  RoundQuestionRow,
  ScoreRow,
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

  const questionState = session.question_state ?? "hidden";
  const roundType = session.current_round_type ?? "unknown";
  const matchId = initialData.match.id;

  const refreshFromServer = useCallback(() => {
    setStatusMessage("Đang đồng bộ dữ liệu mới…");
    router.refresh();
  }, [router]);

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

    const subscribe = async () => {
      try {
        const supabase = await getSupabase();
        if (!mounted) return;
        supabaseRef.current = supabase;
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
          // CNV: nghe obstacle + tile + guess để render board tối thiểu.
          .on(
            "postgres_changes",
            { event: "*", schema: "olympia", table: "obstacles" },
            (payload) => {
              const row = payload.new as ObstacleRow | null;
              if (!row) return;
              if (!session.current_round_id) return;
              if (row.match_round_id !== session.current_round_id) return;
              setObstacle(row);
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "olympia", table: "obstacle_tiles" },
            (payload) => {
              const row = payload.new as ObstacleTileRow | null;
              if (!row) return;
              if (!obstacle?.id) return;
              if (row.obstacle_id !== obstacle.id) return;
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
              if (!obstacle?.id) return;
              if (row.obstacle_id !== obstacle.id) return;
              setObstacleGuesses((prev) => [row, ...prev].slice(0, 20));
            }
          );

        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setRealtimeReady(true);
            setStatusMessage(null);
          }
          if (status === "CHANNEL_ERROR") {
            console.error("Olympia game channel error");
            setStatusMessage("Mất kết nối realtime · đang thử lại…");
          }
        });

        channelRef.current = channel;
      } catch (error) {
        console.error("Olympia game realtime init failed", error);
        setStatusMessage("Không thể kết nối realtime");
      }
    };

    subscribe();

    return () => {
      mounted = false;
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
      if (channelRef.current && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
      } else if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [sessionId, matchId, obstacle?.id, session.current_round_id]);

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
