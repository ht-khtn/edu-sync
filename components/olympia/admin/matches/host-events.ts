export type HostSessionUpdatePayload = {
  currentRoundQuestionId: string | null;
  currentRoundId?: string | null;
  currentRoundType?: string | null;
  questionState?: string | null;
  timerDeadline?: string | null;
  buzzerEnabled?: boolean | null;
  showScoreboardOverlay?: boolean | null;
  showAnswersOverlay?: boolean | null;
  source?: "optimistic" | "realtime";
};

export type HostBuzzerUpdatePayload = {
  roundQuestionId: string | null;
  winnerPlayerId: string | null;
  source?: "optimistic" | "realtime";
};

export type HostStarUseUpdatePayload = {
  roundQuestionId: string;
  playerId: string;
  isEnabled: boolean;
  source?: "optimistic" | "realtime";
};

const EVENT_NAME = "olympia:host-session:update" as const;
const BUZZER_EVENT_NAME = "olympia:host-buzzer:update" as const;
const STAR_USE_EVENT_NAME = "olympia:host-star-use:update" as const;

export function dispatchHostSessionUpdate(payload: HostSessionUpdatePayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<HostSessionUpdatePayload>(EVENT_NAME, { detail: payload }));
}

export function dispatchHostBuzzerUpdate(payload: HostBuzzerUpdatePayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<HostBuzzerUpdatePayload>(BUZZER_EVENT_NAME, { detail: payload })
  );
}

export function subscribeHostSessionUpdate(
  handler: (payload: HostSessionUpdatePayload) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const listener = (evt: Event) => {
    const custom = evt as CustomEvent<HostSessionUpdatePayload>;
    handler(custom.detail);
  };

  window.addEventListener(EVENT_NAME, listener);
  return () => {
    window.removeEventListener(EVENT_NAME, listener);
  };
}

export function subscribeHostBuzzerUpdate(
  handler: (payload: HostBuzzerUpdatePayload) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const listener = (evt: Event) => {
    const custom = evt as CustomEvent<HostBuzzerUpdatePayload>;
    handler(custom.detail);
  };

  window.addEventListener(BUZZER_EVENT_NAME, listener);
  return () => {
    window.removeEventListener(BUZZER_EVENT_NAME, listener);
  };
}

export function dispatchHostStarUseUpdate(payload: HostStarUseUpdatePayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<HostStarUseUpdatePayload>(STAR_USE_EVENT_NAME, { detail: payload })
  );
}

export function subscribeHostStarUseUpdate(
  handler: (payload: HostStarUseUpdatePayload) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const listener = (evt: Event) => {
    const custom = evt as CustomEvent<HostStarUseUpdatePayload>;
    handler(custom.detail);
  };

  window.addEventListener(STAR_USE_EVENT_NAME, listener);
  return () => {
    window.removeEventListener(STAR_USE_EVENT_NAME, listener);
  };
}
