'use client'

import { useEffect, useRef } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { toast } from 'sonner'

import getSupabase from '@/lib/supabase'

type Props = {
    matchId: string
    sessionId: string | null
    currentRoundQuestionId: string | null
    playerLabelsById: Record<string, string>
}

type BuzzerEventRow = {
    id: string
    match_id: string | null
    round_question_id: string | null
    player_id: string | null
    result: string | null
    occurred_at: string | null
}

export function HostRealtimeEventsListener({
    matchId,
    sessionId,
    currentRoundQuestionId,
    playerLabelsById,
}: Props) {
    const supabaseRef = useRef<SupabaseClient | null>(null)

    const channelRef = useRef<RealtimeChannel | null>(null)
    const queuedReasonsRef = useRef<Set<string>>(new Set())
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const reconnectAttemptsRef = useRef<number>(0)

    const currentRoundQuestionIdRef = useRef<string | null>(null)
    useEffect(() => {
        currentRoundQuestionIdRef.current = currentRoundQuestionId
    }, [currentRoundQuestionId])

    const lastWinnerToastRef = useRef<{ roundQuestionId: string | null; buzzerEventId: string | null }>({
        roundQuestionId: null,
        buzzerEventId: null,
    })

    const playerLabelsRef = useRef<Record<string, string>>({})
    useEffect(() => {
        playerLabelsRef.current = playerLabelsById
    }, [playerLabelsById])

    useEffect(() => {
        let mounted = true

        const trackReason = (reason: string) => {
            // Giữ lại để debug, nhưng KHÔNG refresh toàn trang (SSR rất chậm).
            queuedReasonsRef.current.add(reason)
        }

        const cleanupChannel = async () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }

            const channel = channelRef.current
            if (!channel) return
            channelRef.current = null

            try {
                const supabase = supabaseRef.current ?? (await getSupabase())
                supabaseRef.current = supabase
                try {
                    channel.unsubscribe()
                } catch {
                    // ignore
                }
                supabase.removeChannel(channel)
            } catch {
                try {
                    channel.unsubscribe()
                } catch {
                    // ignore
                }
            }
        }

        const scheduleReconnect = (reason: string) => {
            if (!mounted) return
            if (reconnectTimerRef.current) return
            const attempt = reconnectAttemptsRef.current
            const delay = attempt === 0 ? 400 : attempt === 1 ? 1200 : 3000
            reconnectTimerRef.current = setTimeout(() => {
                reconnectTimerRef.current = null
                reconnectAttemptsRef.current = Math.min(reconnectAttemptsRef.current + 1, 10)
                void subscribe(`reconnect:${reason}`)
            }, delay)
        }

        const subscribe = async (why: string) => {
            if (!matchId) return

            try {
                const supabase = supabaseRef.current ?? (await getSupabase())
                supabaseRef.current = supabase
                if (!mounted) return

                await cleanupChannel()

                const channel = supabase
                    .channel(`olympia-host-events-${matchId}`)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'olympia',
                            table: 'live_sessions',
                            ...(sessionId ? { filter: `id=eq.${sessionId}` } : {}),
                        },
                        () => trackReason('live_sessions')
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'star_uses', filter: `match_id=eq.${matchId}` },
                        () => trackReason('star_uses')
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'answers', filter: `match_id=eq.${matchId}` },
                        () => trackReason('answers')
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'buzzer_events', filter: `match_id=eq.${matchId}` },
                        (payload) => {
                            trackReason('buzzer_events')

                            const row = payload.new as BuzzerEventRow | null
                            if (!row) return

                            // Toast chỉ cho người nhanh nhất.
                            if (payload.eventType !== 'INSERT') return
                            if (row.result !== 'win') return
                            const activeQ = currentRoundQuestionIdRef.current
                            if (!activeQ || row.round_question_id !== activeQ) return

                            const alreadyToasted =
                                lastWinnerToastRef.current.roundQuestionId === activeQ &&
                                lastWinnerToastRef.current.buzzerEventId === row.id
                            if (alreadyToasted) return

                            lastWinnerToastRef.current = { roundQuestionId: activeQ, buzzerEventId: row.id }

                            const label = (row.player_id && playerLabelsRef.current[row.player_id]) || 'Một thí sinh'
                            toast.success(`${label} bấm chuông nhanh nhất`)
                        }
                    )

                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        reconnectAttemptsRef.current = 0
                        return
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.error('[HostRealtimeEventsListener] realtime error', { matchId, sessionId })
                        scheduleReconnect('CHANNEL_ERROR')
                    }
                    if (status === 'TIMED_OUT' || status === 'CLOSED') {
                        scheduleReconnect(status)
                    }
                })

                channelRef.current = channel
            } catch {
                // ignore: host vẫn chạy được bằng refresh thủ công
            }
        }

        void subscribe('mount')

        return () => {
            mounted = false
            void cleanupChannel()
        }
    }, [matchId, sessionId])

    return null
}
