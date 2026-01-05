export type HostSessionUpdatePayload = {
  currentRoundQuestionId: string | null;
  questionState?: string | null;
  source?: "optimistic" | "realtime";
};

const EVENT_NAME = "olympia:host-session:update" as const;

export function dispatchHostSessionUpdate(payload: HostSessionUpdatePayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<HostSessionUpdatePayload>(EVENT_NAME, { detail: payload }));
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
