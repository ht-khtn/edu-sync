"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import getSupabase from "@/lib/supabase";

export type HostBroadcastEvent = "decision_ping" | "timer_ping" | "question_ping" | "sound_ping";

export function useHostBroadcast(sessionId: string | null) {
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      if (!sessionId) return;
      const supabase = supabaseRef.current ?? (await getSupabase());
      if (!mounted) return;
      supabaseRef.current = supabase;

      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {
          channelRef.current.unsubscribe();
        }
        channelRef.current = null;
      }

      const channel = supabase.channel(`olympia-game-${sessionId}`);
      channel.subscribe();
      channelRef.current = channel;
    };

    void setup();

    return () => {
      mounted = false;
      const supabase = supabaseRef.current;
      if (supabase && channelRef.current) {
        supabase.removeChannel(channelRef.current);
      } else if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      channelRef.current = null;
    };
  }, [sessionId]);

  const sendBroadcast = useCallback(
    <T extends Record<string, unknown>>(event: HostBroadcastEvent, payload: T) => {
      const channel = channelRef.current;
      if (!channel) return;
      void channel.send({
        type: "broadcast",
        event,
        payload,
      });
    },
    []
  );

  return { sendBroadcast };
}
