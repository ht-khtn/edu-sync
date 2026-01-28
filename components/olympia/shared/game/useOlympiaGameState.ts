/*
 * Game session hook responsible for syncing live session state.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import getSupabase from "@/lib/supabase";
import type {
  AnswerRow,
  BuzzerEventRow,
  GameSessionPayload,
  RoundQuestionRow,
  ScoreRow,
  StarUseRow,
} from "@/types/olympia/game";
import {
  createInitialGuardState,
  handleRealtimeEvent,
  IGuardState,
  IRealtimeEvent,
} from "@/lib/olympia/realtime-guard";

type UseOlympiaGameStateArgs = {
  sessionId: string;
  initialData: GameSessionPayload;
};

type TimerSnapshot = {
  deadline: string | null;
  remainingMs: number | null;
  isExpired: boolean;
};

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

type BuzzerEvent = BuzzerEventRow & {
  payload?: Record<string, JsonValue> | null;
};

type RealtimeEventPayload = Record<string, JsonValue>;

type RealtimeEventRow = {
  id: string;
  match_id: string;
  session_id: string | null;
  entity: string;
  entity_id: string | null;
  event_type: string;
  payload: RealtimeEventPayload;
  created_at: string;
};

export type BuzzerPingEventType = "buzz" | "steal" | "trial";

export type BuzzerPingPayload = {
  matchId: string;
  sessionId: string;
  roundQuestionId: string | null;
  playerId: string | null;
  seatIndex: number | null;
  displayName: string | null;
  eventType: BuzzerPingEventType;
  clientTs: number;
};

export type DecisionPingPayload = {
  matchId: string;
  sessionId: string;
  roundQuestionId: string | null;
  playerId: string | null;
  decision: "correct" | "wrong" | "timeout";
  clientTs: number;
};

export type TimerPingPayload = {
  matchId: string;
  sessionId: string;
  roundQuestionId: string | null;
  action: "start" | "expire";
  deadline: string | null;
  durationMs?: number | null;
  clientTs: number;
};

export type SoundPingEvent = "QUESTION_REVEALED" | "ROUND_ENDED" | "TURN_ENDED";

export type SoundPingRoundType = "khoi_dong" | "vcnv" | "tang_toc" | "ve_dich";

export type SoundPingPayload = {
  matchId: string;
  sessionId: string;
  event: SoundPingEvent;
  roundType?: SoundPingRoundType | null;
  clientTs: number;
};

type QuestionState = "hidden" | "showing" | "answer_revealed" | "completed";

export type QuestionPingPayload = {
  matchId: string;
  sessionId: string;
  roundQuestionId?: string | null;
  questionState?: QuestionState | null;
  showScoreboardOverlay?: boolean | null;
  showAnswersOverlay?: boolean | null;
  clientTs: number;
};

function payloadString(payload: RealtimeEventPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function payloadNumber(payload: RealtimeEventPayload, key: string): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function payloadBoolean(payload: RealtimeEventPayload, key: string): boolean | null {
  const value = payload[key];
  return typeof value === "boolean" ? value : null;
}

function payloadHasKey(payload: RealtimeEventPayload, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

function payloadStringFromKeys(
  payload: RealtimeEventPayload,
  keys: string[]
): string | null | undefined {
  for (const key of keys) {
    if (payloadHasKey(payload, key)) {
      return payloadString(payload, key);
    }
  }
  return undefined;
}

function parseBuzzerPingPayload(payload: unknown): BuzzerPingPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const rec = payload as Record<string, unknown>;

  const matchId = typeof rec.matchId === "string" ? rec.matchId : null;
  const sessionId = typeof rec.sessionId === "string" ? rec.sessionId : null;
  const eventTypeRaw = typeof rec.eventType === "string" ? rec.eventType : null;
  const clientTsRaw = typeof rec.clientTs === "number" ? rec.clientTs : null;

  if (!matchId || !sessionId || !eventTypeRaw || clientTsRaw === null) return null;
  if (!Number.isFinite(clientTsRaw)) return null;
  if (eventTypeRaw !== "buzz" && eventTypeRaw !== "steal" && eventTypeRaw !== "trial") return null;

  const roundQuestionId = typeof rec.roundQuestionId === "string" ? rec.roundQuestionId : null;
  const playerId = typeof rec.playerId === "string" ? rec.playerId : null;
  const seatIndex =
    typeof rec.seatIndex === "number" && Number.isFinite(rec.seatIndex) ? rec.seatIndex : null;
  const displayName = typeof rec.displayName === "string" ? rec.displayName : null;

  return {
    matchId,
    sessionId,
    roundQuestionId,
    playerId,
    seatIndex,
    displayName,
    eventType: eventTypeRaw,
    clientTs: clientTsRaw,
  };
}

function parseDecisionPingPayload(payload: unknown): DecisionPingPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const rec = payload as Record<string, unknown>;

  const matchId = typeof rec.matchId === "string" ? rec.matchId : null;
  const sessionId = typeof rec.sessionId === "string" ? rec.sessionId : null;
  const decisionRaw = typeof rec.decision === "string" ? rec.decision : null;
  const clientTsRaw = typeof rec.clientTs === "number" ? rec.clientTs : null;

  if (!matchId || !sessionId || !decisionRaw || clientTsRaw === null) return null;
  if (!Number.isFinite(clientTsRaw)) return null;
  if (decisionRaw !== "correct" && decisionRaw !== "wrong" && decisionRaw !== "timeout")
    return null;

  const roundQuestionId = typeof rec.roundQuestionId === "string" ? rec.roundQuestionId : null;
  const playerId = typeof rec.playerId === "string" ? rec.playerId : null;

  return {
    matchId,
    sessionId,
    roundQuestionId,
    playerId,
    decision: decisionRaw,
    clientTs: clientTsRaw,
  };
}

function parseSoundPingPayload(payload: unknown): SoundPingPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const rec = payload as Record<string, unknown>;

  const matchId = typeof rec.matchId === "string" ? rec.matchId : null;
  const sessionId = typeof rec.sessionId === "string" ? rec.sessionId : null;
  const eventRaw = typeof rec.event === "string" ? rec.event : null;
  const clientTsRaw = typeof rec.clientTs === "number" ? rec.clientTs : null;

  if (!matchId || !sessionId || !eventRaw || clientTsRaw === null) return null;
  if (!Number.isFinite(clientTsRaw)) return null;

  if (eventRaw !== "QUESTION_REVEALED" && eventRaw !== "ROUND_ENDED" && eventRaw !== "TURN_ENDED") {
    return null;
  }

  const roundTypeRaw = typeof rec.roundType === "string" ? rec.roundType : null;
  const roundType =
    roundTypeRaw === "khoi_dong" ||
    roundTypeRaw === "vcnv" ||
    roundTypeRaw === "tang_toc" ||
    roundTypeRaw === "ve_dich"
      ? roundTypeRaw
      : null;

  return {
    matchId,
    sessionId,
    event: eventRaw as SoundPingEvent,
    roundType,
    clientTs: clientTsRaw,
  };
}

function parseTimerPingPayload(payload: unknown): TimerPingPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const rec = payload as Record<string, unknown>;

  const matchId = typeof rec.matchId === "string" ? rec.matchId : null;
  const sessionId = typeof rec.sessionId === "string" ? rec.sessionId : null;
  const actionRaw = typeof rec.action === "string" ? rec.action : null;
  const clientTsRaw = typeof rec.clientTs === "number" ? rec.clientTs : null;
  const deadlineRaw = typeof rec.deadline === "string" ? rec.deadline : null;
  const durationMsRaw =
    typeof rec.durationMs === "number" && Number.isFinite(rec.durationMs) ? rec.durationMs : null;

  if (!matchId || !sessionId || !actionRaw || clientTsRaw === null) return null;
  if (!Number.isFinite(clientTsRaw)) return null;
  if (actionRaw !== "start" && actionRaw !== "expire") return null;

  const roundQuestionId = typeof rec.roundQuestionId === "string" ? rec.roundQuestionId : null;

  return {
    matchId,
    sessionId,
    roundQuestionId,
    action: actionRaw,
    deadline: deadlineRaw,
    durationMs: durationMsRaw,
    clientTs: clientTsRaw,
  };
}

function parseQuestionPingPayload(payload: unknown): QuestionPingPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const rec = payload as Record<string, unknown>;

  const matchId = typeof rec.matchId === "string" ? rec.matchId : null;
  const sessionId = typeof rec.sessionId === "string" ? rec.sessionId : null;
  const clientTsRaw = typeof rec.clientTs === "number" ? rec.clientTs : null;

  if (!matchId || !sessionId || clientTsRaw === null) return null;
  if (!Number.isFinite(clientTsRaw)) return null;

  let roundQuestionId: string | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(rec, "roundQuestionId")) {
    if (rec.roundQuestionId === null) roundQuestionId = null;
    else if (typeof rec.roundQuestionId === "string") roundQuestionId = rec.roundQuestionId;
    else return null;
  }

  let questionState: QuestionState | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(rec, "questionState")) {
    if (rec.questionState === null) {
      questionState = null;
    } else if (typeof rec.questionState === "string") {
      if (
        rec.questionState === "hidden" ||
        rec.questionState === "showing" ||
        rec.questionState === "answer_revealed" ||
        rec.questionState === "completed"
      ) {
        questionState = rec.questionState;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  let showScoreboardOverlay: boolean | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(rec, "showScoreboardOverlay")) {
    if (rec.showScoreboardOverlay === null) showScoreboardOverlay = null;
    else if (typeof rec.showScoreboardOverlay === "boolean") {
      showScoreboardOverlay = rec.showScoreboardOverlay;
    } else {
      return null;
    }
  }

  let showAnswersOverlay: boolean | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(rec, "showAnswersOverlay")) {
    if (rec.showAnswersOverlay === null) showAnswersOverlay = null;
    else if (typeof rec.showAnswersOverlay === "boolean") {
      showAnswersOverlay = rec.showAnswersOverlay;
    } else {
      return null;
    }
  }

  return {
    matchId,
    sessionId,
    roundQuestionId,
    questionState,
    showScoreboardOverlay,
    showAnswersOverlay,
    clientTs: clientTsRaw,
  };
}

function payloadObject(
  payload: RealtimeEventPayload,
  key: string
): { [k: string]: JsonValue } | null {
  const value = payload[key];
  if (!value) return null;
  if (typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value as { [k: string]: JsonValue };
}
type VcnvRevealMap = Record<string, boolean>;
type VcnvLockMap = Record<string, boolean>;

const OLYMPIA_CLIENT_TRACE = process.env.NEXT_PUBLIC_OLYMPIA_TRACE === "1";

type OlympiaClientTraceFields = Record<string, string | number | boolean | null>;

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function estimateJsonPayloadBytes<T extends object>(value: T | null): number {
  if (!value) return 0;
  try {
    return utf8ByteLength(JSON.stringify(value));
  } catch {
    return 0;
  }
}

function getReceiveLagMs(commitTimestamp: string | null | undefined): number | null {
  if (!commitTimestamp) return null;
  const commitMs = Date.parse(commitTimestamp);
  if (!Number.isFinite(commitMs)) return null;
  const lag = Date.now() - commitMs;
  return lag >= 0 ? lag : 0;
}

function traceClientReceive(params: { event: string; fields: OlympiaClientTraceFields }): void {
  if (!OLYMPIA_CLIENT_TRACE) return;
  const payload = {
    layer: "client-receive",
    action: "postgres_changes",
    event: params.event,
    ts: new Date().toISOString(),
    payloadBytes: typeof params.fields.payloadBytes === "number" ? params.fields.payloadBytes : 0,
    ...params.fields,
  };
  console.info("[Olympia][Trace]", JSON.stringify(payload));
}

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
  const [session, setSession] = useState(initialData.session);
  const [scores, setScores] = useState(initialData.scores);
  const [roundQuestions, setRoundQuestions] = useState(initialData.roundQuestions);
  const [answers, setAnswers] = useState<AnswerRow[]>(initialData.answers ?? []);
  const [starUses, setStarUses] = useState<StarUseRow[]>(initialData.starUses ?? []);
  const [players] = useState(initialData.players);
  const [buzzerEvents, setBuzzerEvents] = useState<BuzzerEvent[]>(initialData.buzzerEvents ?? []);
  const [lastBuzzerPing, setLastBuzzerPing] = useState<BuzzerPingPayload | null>(null);
  const [lastDecisionPing, setLastDecisionPing] = useState<DecisionPingPayload | null>(null);
  const [lastSoundPing, setLastSoundPing] = useState<SoundPingPayload | null>(null);
  const [lastTimerPing, setLastTimerPing] = useState<TimerPingPayload | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isRealtimeReady, setRealtimeReady] = useState(false);
  const [timer, setTimer] = useState<TimerSnapshot>(() =>
    computeRemaining(initialData.session.timer_deadline)
  );
  const [vcnvRevealByRoundQuestionId, setVcnvRevealByRoundQuestionId] = useState<VcnvRevealMap>({});
  const [vcnvLockedWrongByRoundQuestionId, setVcnvLockedWrongByRoundQuestionId] =
    useState<VcnvLockMap>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<Awaited<ReturnType<typeof getSupabase>> | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const retryStoppedRef = useRef(false);
  const subscribeInFlightRef = useRef(false);
  const lastSubscribedChannelRef = useRef<string | null>(null);
  const channelStatusRef = useRef<
    "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED" | "JOINING" | "LEAVING" | "UNKNOWN"
  >("UNKNOWN");
  const subscribeRef = useRef<(() => void) | null>(null);
  const realtimeReadyRef = useRef(false);
  const snapshotInFlightRef = useRef(false);
  const sessionRef = useRef(initialData.session);
  const vcnvTrackedRqIdsRef = useRef<string[]>([]);
  const guardStateRef = useRef<IGuardState>(createInitialGuardState());

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const questionState = session.question_state ?? "hidden";
  const roundType = session.current_round_type ?? "unknown";
  const matchId = initialData.match.id;
  const MAX_RETRIES = 6;
  const MAX_RETRY_DELAY_MS = 10000;

  const resolveRoundQuestionCode = useCallback((rq: RoundQuestionRow | null) => {
    if (!rq) return null;
    const meta = rq.meta;
    if (meta && typeof meta === "object") {
      const rec = meta as Record<string, string | number | boolean | null>;
      const raw = rec.code;
      const trimmed = typeof raw === "string" ? raw.trim().toUpperCase() : "";
      if (trimmed) return trimmed;
    }
    const qs = rq.question_set_items;
    const q = rq.questions;

    const qsiCode = Array.isArray(qs) ? (qs[0]?.code ?? null) : (qs?.code ?? null);
    const qCode = Array.isArray(q) ? (q[0]?.code ?? null) : (q?.code ?? null);
    const raw = qsiCode ?? qCode ?? null;
    const trimmed = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    return trimmed || null;
  }, []);

  const computeVcnvRowQuestionIds = useCallback((): string[] => {
    if (roundType !== "vcnv") return [];
    const currentRoundId = sessionRef.current.current_round_id;
    if (!currentRoundId) return [];

    // VCNV: 4 hàng + ô trung tâm (OTT). Mã có thể là OTT hoặc VCNV-OTT tuỳ dữ liệu.
    const wanted = new Set(["VCNV-1", "VCNV-2", "VCNV-3", "VCNV-4", "OTT", "VCNV-OTT"]);
    const rows = (roundQuestions ?? [])
      .filter((rq) => rq.match_round_id === currentRoundId)
      .map((rq) => ({ id: rq.id, code: resolveRoundQuestionCode(rq) }))
      .filter((item): item is { id: string; code: string } => Boolean(item.id && item.code));

    const byCode = new Map<string, string>();
    for (const row of rows) {
      if (wanted.has(row.code) && !byCode.has(row.code)) byCode.set(row.code, row.id);
    }

    return ["VCNV-1", "VCNV-2", "VCNV-3", "VCNV-4", "OTT", "VCNV-OTT"]
      .map((code) => byCode.get(code) ?? null)
      .filter((id): id is string => Boolean(id));
  }, [resolveRoundQuestionCode, roundQuestions, roundType]);

  const fetchVcnvRevealSnapshot = useCallback(
    async (rqIds: string[]) => {
      if (rqIds.length === 0) {
        setVcnvRevealByRoundQuestionId({});
        setVcnvLockedWrongByRoundQuestionId({});
        return;
      }
      const supabase = supabaseRef.current;
      if (!supabase) return;
      try {
        const olympia = supabase.schema("olympia");

        // Nếu có câu code = CNV và đã có đáp án đúng, coi như "lật toàn bộ" cho tất cả hàng.
        const currentRoundId = sessionRef.current.current_round_id;
        const cnvRqId =
          roundType === "vcnv" && currentRoundId
            ? ((roundQuestions ?? [])
                .filter((rq) => rq.match_round_id === currentRoundId)
                .map((rq) => ({ id: rq.id, code: resolveRoundQuestionCode(rq) }))
                .find((item) => item.code === "CNV")?.id ?? null)
            : null;

        const idsToQuery = cnvRqId ? Array.from(new Set([...rqIds, cnvRqId])) : rqIds;

        const { data, error } = await olympia
          .from("answers")
          .select("round_question_id, player_id, is_correct")
          .eq("match_id", matchId)
          .in("round_question_id", idsToQuery);
        if (error) {
          console.warn("[Olympia] fetch VCNV reveal snapshot failed", error.message);
          return;
        }

        const next: VcnvRevealMap = {};
        const nextLocked: VcnvLockMap = {};
        for (const id of rqIds) {
          next[id] = false;
          nextLocked[id] = false;
        }

        const decidedByRqId = new Map<string, Map<string, boolean>>();
        for (const row of (data as Array<{
          round_question_id: string;
          player_id: string;
          is_correct?: boolean | null;
        }> | null) ?? []) {
          const rqId = row.round_question_id;
          const playerId = row.player_id;
          if (!rqId || !playerId) continue;
          if (row.is_correct === null || row.is_correct === undefined) continue;

          const map = decidedByRqId.get(rqId) ?? new Map<string, boolean>();
          map.set(playerId, row.is_correct === true);
          decidedByRqId.set(rqId, map);
        }

        const anyCnvCorrect =
          Boolean(cnvRqId) &&
          Array.from(decidedByRqId.get(cnvRqId as string)?.values() ?? []).some((v) => v === true);

        // Nếu CNV đã đúng, lật tất cả hàng VCNV (re-use cơ chế lật từng hàng, nhưng thêm guard này).
        if (anyCnvCorrect) {
          for (const rqId of rqIds) {
            next[rqId] = true;
            nextLocked[rqId] = false;
          }
          setVcnvRevealByRoundQuestionId(next);
          setVcnvLockedWrongByRoundQuestionId(nextLocked);
          return;
        }

        // Tính số thí sinh chưa bị khóa (không bị disqualified_obstacle)
        const activePlayersCount = players.filter((p) => !p.is_disqualified_obstacle).length;

        for (const rqId of rqIds) {
          const decided = decidedByRqId.get(rqId);
          if (!decided) continue;

          const anyCorrect = Array.from(decided.values()).some((v) => v === true);
          if (anyCorrect) {
            next[rqId] = true;
            continue;
          }

          // Kiểm tra xem tất cả thí sinh chưa bị khóa đã trả lời sai chưa
          const allActiveDecided = activePlayersCount > 0 && decided.size >= activePlayersCount;
          if (allActiveDecided) {
            nextLocked[rqId] = true;
          }
        }

        setVcnvRevealByRoundQuestionId(next);
        setVcnvLockedWrongByRoundQuestionId(nextLocked);
      } catch (err) {
        console.warn("[Olympia] fetch VCNV reveal snapshot failed", err);
      }
    },
    [matchId, players, resolveRoundQuestionCode, roundQuestions, roundType]
  );

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
      setTimer(computeRemaining(initialData.session.timer_deadline));
    });
  }, [initialData]);

  useEffect(() => {
    const nextIds = computeVcnvRowQuestionIds();
    vcnvTrackedRqIdsRef.current = nextIds;
    void fetchVcnvRevealSnapshot(nextIds);
  }, [computeVcnvRowQuestionIds, fetchVcnvRevealSnapshot]);

  // Fetch VCNV reveal state khi vào vòng VCNV (ngay cả lúc thoát ra rồi vào lại)
  useEffect(() => {
    if (roundType !== "vcnv") return;
    if (!session.current_round_id) return;

    const fetchVcnvOnRoundChange = async () => {
      const supabase = supabaseRef.current;
      if (!supabase) return;

      try {
        const olympia = supabase.schema("olympia");

        // Lấy tất cả round_questions của vòng VCNV này
        const { data: rqRows, error: rqError } = await olympia
          .from("round_questions")
          .select("id, meta, questions(code), question_set_items(code)")
          .eq("match_round_id", session.current_round_id);

        if (rqError) {
          console.warn("[Olympia] fetch VCNV questions on round change failed", rqError.message);
          return;
        }

        // Lọc ra các ô VCNV (VCNV-1 đến VCNV-4, OTT/VCNV-OTT)
        const wanted = new Set(["VCNV-1", "VCNV-2", "VCNV-3", "VCNV-4", "OTT", "VCNV-OTT"]);
        const rqIds: string[] = [];

        for (const rq of (rqRows as Array<{
          id: string;
          meta?: Record<string, string | number | boolean | null> | null;
          questions?: { code?: string } | null;
          question_set_items?: { code?: string } | null;
        }> | null) ?? []) {
          let code: string | null = null;

          // Ưu tiên meta.code
          if (rq.meta && typeof rq.meta === "object") {
            const raw = (rq.meta as Record<string, string | number | boolean | null>).code;
            code = typeof raw === "string" ? raw.trim().toUpperCase() : null;
          }

          // Fallback: questions.code hoặc question_set_items.code
          if (!code) {
            code = rq.questions?.code ?? rq.question_set_items?.code ?? null;
            if (code) code = code.trim().toUpperCase();
          }

          if (code && wanted.has(code)) {
            rqIds.push(rq.id);
          }
        }

        if (rqIds.length > 0) {
          vcnvTrackedRqIdsRef.current = rqIds;
          await fetchVcnvRevealSnapshot(rqIds);
        }
      } catch (err) {
        console.warn("[Olympia] fetch VCNV on round change failed", err);
      }
    };

    void fetchVcnvOnRoundChange();
  }, [roundType, session.current_round_id, fetchVcnvRevealSnapshot]);

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

  const refreshCurrentRoundQuestion = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    const currentRqId = sessionRef.current.current_round_question_id;
    if (!currentRqId) return;
    if (typeof document !== "undefined" && document.hidden) return;

    try {
      const olympia = supabase.schema("olympia");
      const { data: rqRow, error } = await olympia
        .from("round_questions")
        .select(
          "id, match_round_id, question_id, question_set_item_id, order_index, target_player_id, meta, question_text, answer_text, note, questions(id, code, category, question_text, answer_text, note, image_url, audio_url), question_set_items(id, code, category, question_text, answer_text, note, image_url, audio_url)"
        )
        .eq("id", currentRqId)
        .maybeSingle();

      if (error || !rqRow) return;

      setRoundQuestions((prev) => {
        const next = [...prev];
        const idx = next.findIndex((row) => row.id === rqRow.id);
        const normalized = rqRow as RoundQuestionRow;
        if (idx === -1) next.push(normalized);
        else next[idx] = { ...next[idx], ...normalized };
        return next;
      });
    } catch {
      // im lặng: polling nhẹ, không cần spam log
    }
  }, []);

  const fetchSnapshotOnce = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    if (typeof document !== "undefined" && document.hidden) return;
    if (snapshotInFlightRef.current) return;
    snapshotInFlightRef.current = true;

    try {
      const olympia = supabase.schema("olympia");

      const { data: nextSession, error: sessionError } = await olympia
        .from("live_sessions")
        .select(
          "id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline, requires_player_password, buzzer_enabled, show_scoreboard_overlay, show_answers_overlay, guest_media_control"
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

      // Fetch toàn bộ round_questions để cập nhật target_player_id (khi host chọn thí sinh)
      const { data: allRoundQuestions, error: allRqError } = await olympia
        .from("round_questions")
        .select(
          "id, match_round_id, target_player_id, meta, order_index, question_id, question_set_item_id, question_text, answer_text, note"
        );
      if (!allRqError && allRoundQuestions) {
        // Merge thay vì overwrite để không làm mất join fields (questions/question_set_items)
        // Tránh flicker media (image_url/audio_url) khi polling snapshot.
        setRoundQuestions((prev) => {
          const incoming = allRoundQuestions as unknown as RoundQuestionRow[];
          if (!Array.isArray(prev) || prev.length === 0) return incoming;
          const byId = new Map(prev.map((r) => [r.id, r]));
          for (const row of incoming) {
            const existing = byId.get(row.id);
            byId.set(row.id, existing ? { ...existing, ...row } : row);
          }
          return Array.from(byId.values());
        });
      }

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
            const normalized = rqRow as RoundQuestionRow;
            if (idx === -1) next.push(normalized);
            else next[idx] = { ...next[idx], ...normalized };
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
      snapshotInFlightRef.current = false;
    }
  }, [fetchAnswersForQuestion, matchId, sessionId]);

  const refreshFromServer = useCallback(() => {
    setStatusMessage("Đang đồng bộ dữ liệu mới…");
    void fetchSnapshotOnce();
  }, [fetchSnapshotOnce]);

  const sendBuzzerPing = useCallback(
    (payload: BuzzerPingPayload) => {
      const channel = channelRef.current;
      if (!channel) return;
      if (payload.matchId !== matchId || payload.sessionId !== sessionId) return;
      void channel.send({
        type: "broadcast",
        event: "buzzer_ping",
        payload,
      });
    },
    [matchId, sessionId]
  );

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
      if (subscribeInFlightRef.current || retryStoppedRef.current) return;
      const desiredTopic = `realtime:olympia-game-${sessionId}`;
      if (channelRef.current?.topic === desiredTopic && channelStatusRef.current === "SUBSCRIBED") {
        return;
      }
      subscribeInFlightRef.current = true;
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
          .on("broadcast", { event: "buzzer_ping" }, ({ payload }) => {
            const parsed = parseBuzzerPingPayload(payload);
            if (!parsed) return;
            if (parsed.matchId !== matchId || parsed.sessionId !== sessionId) return;
            setLastBuzzerPing(parsed);
          })
          .on("broadcast", { event: "decision_ping" }, ({ payload }) => {
            const parsed = parseDecisionPingPayload(payload);
            if (!parsed) return;
            if (parsed.matchId !== matchId || parsed.sessionId !== sessionId) return;
            setLastDecisionPing(parsed);
          })
          .on("broadcast", { event: "timer_ping" }, ({ payload }) => {
            const parsed = parseTimerPingPayload(payload);
            if (!parsed) return;
            if (parsed.matchId !== matchId || parsed.sessionId !== sessionId) return;
            setLastTimerPing(parsed);
            setSession((prev) => ({
              ...prev,
              timer_deadline: parsed.deadline ?? null,
            }));
          })
          .on("broadcast", { event: "question_ping" }, ({ payload }) => {
            const parsed = parseQuestionPingPayload(payload);
            if (!parsed) return;
            if (parsed.matchId !== matchId || parsed.sessionId !== sessionId) return;
            const lagMs = Date.now() - parsed.clientTs;
            if (Number.isFinite(lagMs) && lagMs > 2000) return;

            setSession((prev) => ({
              ...prev,
              question_state:
                parsed.questionState !== undefined
                  ? parsed.questionState
                  : (prev.question_state ?? null),
              current_round_question_id:
                parsed.roundQuestionId !== undefined
                  ? parsed.roundQuestionId
                  : (prev.current_round_question_id ?? null),
              show_scoreboard_overlay:
                parsed.showScoreboardOverlay !== undefined && parsed.showScoreboardOverlay !== null
                  ? parsed.showScoreboardOverlay
                  : prev.show_scoreboard_overlay,
              show_answers_overlay:
                parsed.showAnswersOverlay !== undefined && parsed.showAnswersOverlay !== null
                  ? parsed.showAnswersOverlay
                  : prev.show_answers_overlay,
            }));
          })
          .on("broadcast", { event: "sound_ping" }, ({ payload }) => {
            const parsed = parseSoundPingPayload(payload);
            if (!parsed) return;
            if (parsed.matchId !== matchId || parsed.sessionId !== sessionId) return;
            const lagMs = Date.now() - parsed.clientTs;
            if (Number.isFinite(lagMs) && lagMs > 2000) return;
            setLastSoundPing(parsed);
          })
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "olympia",
              table: "realtime_events",
              filter: `match_id=eq.${matchId}`,
            },
            (payload: RealtimePostgresChangesPayload<RealtimeEventRow>) => {
              const commitTs = payload.commit_timestamp ?? null;
              const receiveLagMs = getReceiveLagMs(commitTs);
              const evt = (payload.new as RealtimeEventRow | null) ?? null;
              traceClientReceive({
                event: `receive:realtime_events:${evt?.entity ?? "unknown"}`,
                fields: {
                  sessionId,
                  matchId,
                  eventType: evt?.event_type ?? null,
                  commitTs,
                  receiveLagMs,
                  payloadBytes: estimateJsonPayloadBytes(evt?.payload ?? null),
                },
              });

              if (!evt) return;

              // --- REALTIME GUARD ---
              const occurredAt = commitTs
                ? new Date(commitTs).getTime()
                : evt.created_at
                  ? Date.parse(evt.created_at)
                  : Date.now();

              const genericEvent: IRealtimeEvent = {
                id: evt.id,
                intent: "MUTATION",
                target_entity_id: evt.match_id,
                occurred_at: occurredAt,
                payload: evt as unknown as Record<string, unknown>,
              };

              // Ensure scope
              guardStateRef.current.activeEntityId = matchId;

              handleRealtimeEvent(genericEvent, guardStateRef.current, (data) => {
                const evt = data as RealtimeEventRow;
                // Logic below is unchanged, just wrapped
                // evt.match_id check is redundant due to guard but harmless

                if (evt.match_id !== matchId) return;

                if (evt.entity === "live_sessions") {
                  if (evt.session_id && evt.session_id !== sessionId) return;

                  // Some realtime payloads may use camelCase keys while others use snake_case
                  // (depending on how the DB/bridge serializes JSON). Support both.
                  const guestMediaControlObj =
                    payloadObject(evt.payload, "guestMediaControl") ??
                    payloadObject(evt.payload, "guest_media_control");
                  const guestMediaControl = guestMediaControlObj
                    ? (guestMediaControlObj as GameSessionPayload["session"]["guest_media_control"])
                    : undefined;

                  if (guestMediaControl) {
                    try {
                      console.info(
                        "[Olympia][Realtime] guest_media_control payload",
                        guestMediaControl
                      );
                    } catch {
                      /* ignore */
                    }
                  }

                  setSession((prev) => {
                    const nextQuestionState = payloadStringFromKeys(evt.payload, [
                      "questionState",
                      "question_state",
                    ]);
                    const nextRoundId = payloadStringFromKeys(evt.payload, [
                      "currentRoundId",
                      "current_round_id",
                    ]);
                    const nextRoundType = payloadStringFromKeys(evt.payload, [
                      "currentRoundType",
                      "current_round_type",
                    ]);
                    const nextRoundQuestionId = payloadStringFromKeys(evt.payload, [
                      "currentRoundQuestionId",
                      "current_round_question_id",
                    ]);
                    const nextTimerDeadline = payloadStringFromKeys(evt.payload, [
                      "timerDeadline",
                      "timer_deadline",
                    ]);

                    return {
                      ...prev,
                      status: payloadString(evt.payload, "status") ?? prev.status,
                      join_code:
                        payloadStringFromKeys(evt.payload, ["joinCode", "join_code"]) ??
                        prev.join_code,
                      question_state: nextQuestionState ?? prev.question_state,
                      current_round_id: nextRoundId ?? prev.current_round_id,
                      current_round_type: nextRoundType ?? prev.current_round_type,
                      current_round_question_id:
                        nextRoundQuestionId ?? prev.current_round_question_id,
                      timer_deadline: nextTimerDeadline ?? prev.timer_deadline,
                      buzzer_enabled:
                        payloadBoolean(evt.payload, "buzzerEnabled") ?? prev.buzzer_enabled,
                      show_scoreboard_overlay:
                        payloadBoolean(evt.payload, "showScoreboardOverlay") ??
                        prev.show_scoreboard_overlay,
                      show_answers_overlay:
                        payloadBoolean(evt.payload, "showAnswersOverlay") ??
                        prev.show_answers_overlay,
                      guest_media_control: guestMediaControl ?? prev.guest_media_control,
                    };
                  });
                  return;
                }

                if (evt.entity === "match_scores") {
                  const id = payloadString(evt.payload, "id");
                  const playerId = payloadString(evt.payload, "playerId");
                  const roundTypeValue = payloadString(evt.payload, "roundType");
                  const points = payloadNumber(evt.payload, "points");
                  if (!id || !playerId) return;

                  setScores((prev) => {
                    const next = [...prev];
                    const idx = next.findIndex((row) => (row.id ?? "") === id);
                    if (evt.event_type === "DELETE") {
                      if (idx === -1) return prev;
                      next.splice(idx, 1);
                      return next;
                    }

                    const nextScore: ScoreRow = {
                      id,
                      match_id: matchId,
                      player_id: playerId,
                      round_type: roundTypeValue,
                      points,
                    };
                    if (idx === -1) next.push(nextScore);
                    else next[idx] = { ...next[idx], ...nextScore };
                    return next;
                  });
                  return;
                }

                if (evt.entity === "round_questions") {
                  const id =
                    payloadString(evt.payload, "id") ??
                    payloadString(evt.payload, "roundQuestionId");
                  if (!id) return;

                  const matchRoundId = payloadStringFromKeys(evt.payload, [
                    "matchRoundId",
                    "match_round_id",
                  ]);
                  const targetPlayerId = payloadStringFromKeys(evt.payload, [
                    "targetPlayerId",
                    "target_player_id",
                  ]);
                  const questionSetItemId = payloadStringFromKeys(evt.payload, [
                    "questionSetItemId",
                    "question_set_item_id",
                  ]);

                  const orderIndexRaw = payloadHasKey(evt.payload, "orderIndex")
                    ? evt.payload.orderIndex
                    : payloadHasKey(evt.payload, "order_index")
                      ? evt.payload.order_index
                      : undefined;
                  const orderIndex =
                    typeof orderIndexRaw === "number" && Number.isFinite(orderIndexRaw)
                      ? orderIndexRaw
                      : orderIndexRaw !== undefined
                        ? null
                        : undefined;

                  const questionTextRaw = payloadHasKey(evt.payload, "questionText")
                    ? evt.payload.questionText
                    : payloadHasKey(evt.payload, "question_text")
                      ? evt.payload.question_text
                      : undefined;
                  const answerTextRaw = payloadHasKey(evt.payload, "answerText")
                    ? evt.payload.answerText
                    : payloadHasKey(evt.payload, "answer_text")
                      ? evt.payload.answer_text
                      : undefined;
                  const noteRaw = payloadHasKey(evt.payload, "note") ? evt.payload.note : undefined;

                  const metaRaw = payloadHasKey(evt.payload, "meta")
                    ? payloadObject(evt.payload, "meta")
                    : undefined;

                  setRoundQuestions((prev) => {
                    const idx = prev.findIndex((row) => row.id === id);
                    if (evt.event_type === "DELETE") {
                      if (idx === -1) return prev;
                      const next = prev.slice();
                      next.splice(idx, 1);
                      return next;
                    }

                    const update: Partial<RoundQuestionRow> = {};
                    if (matchRoundId !== undefined) update.match_round_id = matchRoundId ?? null;
                    if (targetPlayerId !== undefined)
                      update.target_player_id = targetPlayerId ?? null;
                    if (questionSetItemId !== undefined)
                      update.question_set_item_id = questionSetItemId ?? null;
                    if (orderIndex !== undefined) update.order_index = orderIndex ?? null;
                    if (metaRaw !== undefined) {
                      update.meta = metaRaw
                        ? (metaRaw as Record<string, string | number | boolean | null>)
                        : null;
                    }
                    if (questionTextRaw !== undefined) {
                      update.question_text =
                        typeof questionTextRaw === "string" ? questionTextRaw : null;
                    }
                    if (answerTextRaw !== undefined) {
                      update.answer_text = typeof answerTextRaw === "string" ? answerTextRaw : null;
                    }
                    if (noteRaw !== undefined) {
                      update.note = typeof noteRaw === "string" ? noteRaw : null;
                    }

                    if (idx === -1) {
                      return [
                        {
                          id,
                          match_round_id: update.match_round_id ?? null,
                          question_id: null,
                          order_index: update.order_index ?? null,
                          target_player_id: update.target_player_id ?? null,
                          question_set_item_id: update.question_set_item_id ?? null,
                          meta: update.meta ?? null,
                          question_text: update.question_text ?? null,
                          answer_text: update.answer_text ?? null,
                          note: update.note ?? null,
                        },
                        ...prev,
                      ];
                    }

                    const next = prev.slice();
                    next[idx] = { ...next[idx], ...update };
                    return next;
                  });
                  return;
                }

                if (evt.entity === "star_uses") {
                  const id = payloadString(evt.payload, "id");
                  const playerId = payloadString(evt.payload, "playerId");
                  const roundQuestionId = payloadString(evt.payload, "roundQuestionId");
                  const declaredAt = payloadString(evt.payload, "declaredAt");
                  if (!id || !playerId || !roundQuestionId) return;
                  if (!declaredAt) return;

                  const row: StarUseRow = {
                    id,
                    match_id: matchId,
                    player_id: playerId,
                    round_question_id: roundQuestionId,
                    outcome: payloadString(evt.payload, "outcome"),
                    declared_at: declaredAt,
                  };

                  setStarUses((prev) => {
                    const idx = prev.findIndex(
                      (s) =>
                        s.id === row.id ||
                        (s.round_question_id === row.round_question_id &&
                          s.player_id === row.player_id)
                    );
                    if (evt.event_type === "DELETE") {
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
                  return;
                }

                if (evt.entity === "buzzer_events") {
                  const id = payloadString(evt.payload, "id");
                  if (!id) return;
                  const row: BuzzerEvent = {
                    id,
                    match_id: matchId,
                    round_question_id: payloadString(evt.payload, "roundQuestionId"),
                    player_id: payloadString(evt.payload, "playerId"),
                    event_type: payloadString(evt.payload, "eventType"),
                    result: payloadString(evt.payload, "result"),
                    occurred_at: payloadString(evt.payload, "occurredAt"),
                  };

                  setBuzzerEvents((prev) => {
                    const idx = prev.findIndex((e) => e.id === row.id);
                    if (evt.event_type === "DELETE") {
                      if (idx === -1) return prev;
                      const next = prev.slice();
                      next.splice(idx, 1);
                      return next;
                    }
                    if (idx === -1) return [row, ...prev].slice(0, 20);
                    const next = prev.slice();
                    next[idx] = { ...next[idx], ...row };
                    return next;
                  });
                  return;
                }

                if (evt.entity === "answers") {
                  const id = payloadString(evt.payload, "id");
                  const roundQuestionId = payloadString(evt.payload, "roundQuestionId");
                  const playerId = payloadString(evt.payload, "playerId");
                  const submittedAt = payloadString(evt.payload, "submittedAt");
                  if (!id || !roundQuestionId || !playerId || !submittedAt) return;

                  const row: AnswerRow = {
                    id,
                    match_id: matchId,
                    round_question_id: roundQuestionId,
                    player_id: playerId,
                    answer_text: payloadString(evt.payload, "answerText"),
                    is_correct: payloadBoolean(evt.payload, "isCorrect"),
                    points_awarded: payloadNumber(evt.payload, "pointsAwarded"),
                    submitted_at: submittedAt,
                    response_time_ms: payloadNumber(evt.payload, "responseTimeMs"),
                  };

                  const trackedVcnvIds = vcnvTrackedRqIdsRef.current;
                  const isTrackedVcnv = trackedVcnvIds.includes(row.round_question_id);
                  const currentRqId = sessionRef.current.current_round_question_id;
                  const isCurrentQuestion = Boolean(
                    currentRqId && row.round_question_id === currentRqId
                  );
                  const isVcnvRound = sessionRef.current.current_round_type === "vcnv";

                  // Ưu tiên: nếu là câu hiện tại, luôn update answers ngay (đã filter bằng isCurrentQuestion ở dưới)
                  // Nếu là VCNV tracked, fetch snapshot để update VCNV reveal/lock state

                  if (isTrackedVcnv || isVcnvRound) {
                    const rqIdsToCheck = isTrackedVcnv
                      ? trackedVcnvIds
                      : computeVcnvRowQuestionIds();
                    if (rqIdsToCheck.length > 0) {
                      void fetchVcnvRevealSnapshot(rqIdsToCheck);
                    }
                  }

                  if (isCurrentQuestion) {
                    setAnswers((prev) => {
                      if (evt.event_type === "DELETE") {
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
                }
              });
            }
          );
        channelRef.current = channel;

        channel.subscribe((status) => {
          if (!mounted) return;
          if (channelRef.current !== channel) return;
          const channelTopic = channel.topic ?? "unknown";
          const nextStatus = typeof status === "string" ? status : "UNKNOWN";
          channelStatusRef.current = nextStatus;
          if (status === "SUBSCRIBED") {
            setRealtimeReady(true);
            realtimeReadyRef.current = true;
            setStatusMessage(null);
            retryCountRef.current = 0;
            retryStoppedRef.current = false;
            clearRetryTimer();
            if (lastSubscribedChannelRef.current !== channelTopic) {
              lastSubscribedChannelRef.current = channelTopic;
              console.info("[Olympia] realtime subscribed", {
                status,
                channel: channelTopic,
                matchId,
                sessionId,
              });
            }
            void fetchSnapshotOnce();
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setRealtimeReady(false);
            realtimeReadyRef.current = false;

            if (retryStoppedRef.current || retryTimerRef.current) return;

            const nextCount = retryCountRef.current + 1;
            if (nextCount > MAX_RETRIES) {
              retryStoppedRef.current = true;
              setStatusMessage("Mất kết nối realtime · vui lòng tải lại trang.");
              return;
            }

            retryCountRef.current = nextCount;
            const delayMs = Math.min(MAX_RETRY_DELAY_MS, 500 * Math.pow(2, nextCount));
            console.warn("[Olympia] realtime channel status", {
              status,
              channel: channelTopic,
              matchId,
              sessionId,
              retryInMs: delayMs,
              attempt: nextCount,
            });
            setStatusMessage("Mất kết nối realtime · đang thử lại…");

            clearRetryTimer();
            retryTimerRef.current = setTimeout(() => {
              if (!mounted) return;
              void subscribe();
            }, delayMs);
          }
        });
      } catch (error) {
        console.error("Olympia game realtime init failed", error);
        setStatusMessage("Không thể kết nối realtime");
      } finally {
        subscribeInFlightRef.current = false;
      }
    };

    subscribeRef.current = () => {
      void subscribe();
    };

    subscribe();

    return () => {
      mounted = false;
      subscribeRef.current = null;
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (channelRef.current && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
      } else if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [sessionId, matchId, fetchSnapshotOnce, fetchVcnvRevealSnapshot, computeVcnvRowQuestionIds]);

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

  // Poll nhẹ để cập nhật target_player_id của câu hiện tại (khi host chọn thí sinh)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const intervalId = window.setInterval(() => {
      void refreshCurrentRoundQuestion();
    }, 2000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshCurrentRoundQuestion]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof document === "undefined") return;

    const tryResume = (reason: "visibility" | "online") => {
      if (document.hidden) return;
      if (channelStatusRef.current === "SUBSCRIBED") return;
      retryStoppedRef.current = false;
      retryCountRef.current = 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      console.info("[Olympia] realtime resume", {
        reason,
        matchId,
        sessionId,
      });
      subscribeRef.current?.();
    };

    const onOnline = () => {
      tryResume("online");
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        tryResume("visibility");
      }
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [matchId, sessionId]);

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
    vcnvRevealByRoundQuestionId,
    vcnvLockedWrongByRoundQuestionId,
    timer,
    timerLabel,
    questionState,
    roundType,
    statusMessage,
    isRealtimeReady,
    viewerUserId: initialData.viewerUserId,
    lastBuzzerPing,
    lastDecisionPing,
    lastSoundPing,
    lastTimerPing,
    sendBuzzerPing,
    refreshFromServer,
  };
}
