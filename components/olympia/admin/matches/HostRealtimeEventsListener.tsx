'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
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
    const router = useRouter()

    const channelRef = useRef<RealtimeChannel | null>(null)
    const pendingRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastRefreshAtRef = useRef<number>(0)

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

        const scheduleRefresh = (reason: string) => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

            const now = Date.now()
            const elapsed = now - lastRefreshAtRef.current
            const delay = elapsed < 200 ? 200 - elapsed : 60

            if (pendingRefreshRef.current) return
            pendingRefreshRef.current = setTimeout(() => {
                pendingRefreshRef.current = null
                lastRefreshAtRef.current = Date.now()
                console.debug('[HostRealtimeEventsListener] router.refresh()', reason)
                router.refresh()
            }, delay)
        }

        const subscribe = async () => {
            if (!matchId) return

            try {
                const supabase = await getSupabase()
                if (!mounted) return

                if (channelRef.current) {
                    try {
                        supabase.removeChannel(channelRef.current)
                    } catch {
                        channelRef.current.unsubscribe()
                    }
                    channelRef.current = null
                }

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
                        () => scheduleRefresh('live_sessions')
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'match_scores', filter: `match_id=eq.${matchId}` },
                        () => scheduleRefresh('match_scores')
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'score_changes', filter: `match_id=eq.${matchId}` },
                        () => scheduleRefresh('score_changes')
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'star_uses', filter: `match_id=eq.${matchId}` },
                        () => scheduleRefresh('star_uses')
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'answers', filter: `match_id=eq.${matchId}` },
                        () => scheduleRefresh('answers')
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'buzzer_events', filter: `match_id=eq.${matchId}` },
                        (payload) => {
                            scheduleRefresh('buzzer_events')

                            const row = payload.new as BuzzerEventRow | null
                            if (!row) return

                            // Toast chỉ cho người nhanh nhất.
                            if (payload.eventType !== 'INSERT') return
                            if (row.result !== 'win') return
                            if (!currentRoundQuestionId || row.round_question_id !== currentRoundQuestionId) return

                            const alreadyToasted =
                                lastWinnerToastRef.current.roundQuestionId === currentRoundQuestionId &&
                                lastWinnerToastRef.current.buzzerEventId === row.id
                            if (alreadyToasted) return

                            lastWinnerToastRef.current = { roundQuestionId: currentRoundQuestionId, buzzerEventId: row.id }

                            const label = (row.player_id && playerLabelsRef.current[row.player_id]) || 'Một thí sinh'
                            toast.success(`${label} bấm chuông nhanh nhất`)
                        }
                    )

                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        scheduleRefresh('subscribed')
                        return
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.error('[HostRealtimeEventsListener] realtime error')
                    }
                })

                channelRef.current = channel
            } catch {
                // ignore: host vẫn chạy được bằng refresh thủ công
            }
        }

        void subscribe()

        return () => {
            mounted = false
            if (pendingRefreshRef.current) {
                clearTimeout(pendingRefreshRef.current)
                pendingRefreshRef.current = null
            }

            const cleanup = async () => {
                const channel = channelRef.current
                if (!channel) return
                try {
                    const supabase = await getSupabase()
                    supabase.removeChannel(channel)
                } catch {
                    channel.unsubscribe()
                }
                if (channelRef.current === channel) channelRef.current = null
            }

            void cleanup()
        }
    }, [currentRoundQuestionId, matchId, router, sessionId])

    return null
}
