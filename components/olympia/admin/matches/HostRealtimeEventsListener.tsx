'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import getSupabase from '@/lib/supabase'
import { dispatchHostBuzzerUpdate, dispatchHostSessionUpdate } from '@/components/olympia/admin/matches/host-events'
import { subscribeHostSessionUpdate } from '@/components/olympia/admin/matches/host-events'

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
    event_type: string | null
    occurred_at: string | null
}

type LiveSessionRow = {
    id: string
    current_round_question_id: string | null
    question_state: string | null
    timer_deadline: string | null
}

export function HostRealtimeEventsListener({
    matchId,
    sessionId,
    currentRoundQuestionId,
    playerLabelsById,
}: Props) {
    const router = useRouter()
    const supabaseRef = useRef<SupabaseClient | null>(null)

    const channelRef = useRef<RealtimeChannel | null>(null)
    const queuedReasonsRef = useRef<Set<string>>(new Set())
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const reconnectAttemptsRef = useRef<number>(0)

    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const currentRoundQuestionIdRef = useRef<string | null>(null)
    useEffect(() => {
        currentRoundQuestionIdRef.current = currentRoundQuestionId
    }, [currentRoundQuestionId])

    // Đồng bộ activeQ ngay cả khi host đang optimistic (đổi câu) và SSR chưa refresh kịp.
    useEffect(() => {
        return subscribeHostSessionUpdate((payload) => {
            if (payload.currentRoundQuestionId !== undefined) {
                currentRoundQuestionIdRef.current = payload.currentRoundQuestionId
            }
        })
    }, [])

    const lastWinnerToastRef = useRef<{ roundQuestionId: string | null; buzzerEventId: string | null }>({
        roundQuestionId: null,
        buzzerEventId: null,
    })

    const playerLabelsRef = useRef<Record<string, string>>({})

    const toastWinnerOnce = useCallback((row: BuzzerEventRow) => {
        const activeQ = currentRoundQuestionIdRef.current
        if (!activeQ || row.round_question_id !== activeQ) return
        if (row.result !== 'win') return
        if (row.event_type !== 'buzz' && row.event_type !== 'steal') return
        if (!row.id) return

        const alreadyToasted =
            lastWinnerToastRef.current.roundQuestionId === activeQ &&
            lastWinnerToastRef.current.buzzerEventId === row.id
        if (alreadyToasted) return

        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                const key = `olympia-host-winner-toast:${matchId}:${activeQ}:${row.id}`
                if (window.sessionStorage.getItem(key)) return
                window.sessionStorage.setItem(key, '1')
            }
        } catch {
            // ignore
        }

        lastWinnerToastRef.current = { roundQuestionId: activeQ, buzzerEventId: row.id }
        const label = (row.player_id && playerLabelsRef.current[row.player_id]) || 'Một thí sinh'
        toast.success(`${label} bấm chuông nhanh nhất`)
    }, [matchId])

    useEffect(() => {
        playerLabelsRef.current = playerLabelsById
    }, [playerLabelsById])

    useEffect(() => {
        let mounted = true

        const hydrateExistingWinnerToast = async () => {
            try {
                const activeQ = currentRoundQuestionIdRef.current
                if (!matchId || !activeQ) return

                const supabase = supabaseRef.current ?? (await getSupabase())
                supabaseRef.current = supabase
                if (!mounted) return

                const olympia = supabase.schema('olympia')

                const { data: lastReset, error: resetErr } = await olympia
                    .from('buzzer_events')
                    .select('occurred_at')
                    .eq('match_id', matchId)
                    .eq('round_question_id', activeQ)
                    .eq('event_type', 'reset')
                    .order('occurred_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()
                if (resetErr) return
                const resetOccurredAt = (lastReset as { occurred_at?: string | null } | null)?.occurred_at ?? null

                let winnerQuery = olympia
                    .from('buzzer_events')
                    .select('id, match_id, round_question_id, player_id, result, event_type, occurred_at')
                    .eq('match_id', matchId)
                    .eq('round_question_id', activeQ)
                    .in('event_type', ['buzz', 'steal'])
                    .eq('result', 'win')
                if (resetOccurredAt) winnerQuery = winnerQuery.gte('occurred_at', resetOccurredAt)

                const { data: winner, error: winnerErr } = await winnerQuery
                    .order('occurred_at', { ascending: true })
                    .limit(1)
                    .maybeSingle()
                if (winnerErr) return
                if (!winner) return

                dispatchHostBuzzerUpdate({
                    roundQuestionId: activeQ,
                    winnerPlayerId: (winner as unknown as BuzzerEventRow).player_id ?? null,
                    source: 'realtime',
                })
                toastWinnerOnce(winner as unknown as BuzzerEventRow)
            } catch {
                // ignore
            }
        }

        const scheduleRefresh = (reason: string) => {
            if (!mounted) return
            if (typeof document !== 'undefined' && document.hidden) return
            if (refreshTimerRef.current) return
            refreshTimerRef.current = setTimeout(() => {
                refreshTimerRef.current = null
                console.debug('[HostRealtimeEventsListener] router.refresh', reason)
                router.refresh()
            }, 220)
        }

        const trackReason = (reason: string) => {
            // Giữ lại để debug, nhưng KHÔNG refresh toàn trang (SSR rất chậm).
            queuedReasonsRef.current.add(reason)
        }

        const cleanupChannel = async () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }

            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current)
                refreshTimerRef.current = null
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

        const scheduleReconnect = () => {
            if (!mounted) return
            if (reconnectTimerRef.current) return
            const attempt = reconnectAttemptsRef.current
            const delay = attempt === 0 ? 400 : attempt === 1 ? 1200 : 3000
            reconnectTimerRef.current = setTimeout(() => {
                reconnectTimerRef.current = null
                reconnectAttemptsRef.current = Math.min(reconnectAttemptsRef.current + 1, 10)
                void subscribe()
            }, delay)
        }

        const subscribe = async () => {
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
                        (payload) => {
                            trackReason('live_sessions')

                            const row = (payload.new as LiveSessionRow | null) ?? null
                            if (row) {
                                dispatchHostSessionUpdate({
                                    currentRoundQuestionId: row.current_round_question_id,
                                    questionState: row.question_state,
                                    timerDeadline: row.timer_deadline,
                                    source: 'realtime',
                                })
                            }

                            // Host page là SSR; đồng bộ nhẹ khi session đổi câu/trạng thái.
                            scheduleRefresh('live_sessions')
                        }
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'star_uses', filter: `match_id=eq.${matchId}` },
                        () => {
                            trackReason('star_uses')
                            scheduleRefresh('star_uses')
                        }
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'answers', filter: `match_id=eq.${matchId}` },
                        (payload) => {
                            trackReason('answers')
                            // Chỉ refresh khi host chấm điểm (UPDATE), không refresh khi thí sinh submit (INSERT)
                            // UPDATE → is_correct được set → host cần thấy kết quả lật hết
                            if (payload.eventType === 'UPDATE') {
                                scheduleRefresh('answers:update')
                            }
                        }
                    )
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'buzzer_events', filter: `match_id=eq.${matchId}` },
                        (payload) => {
                            trackReason('buzzer_events')

                            const row = payload.new as BuzzerEventRow | null
                            if (!row) return

                            const activeQ = currentRoundQuestionIdRef.current
                            const sameQuestion = Boolean(activeQ && row.round_question_id === activeQ)
                            if (sameQuestion && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
                                if (payload.eventType === 'INSERT' && row.event_type === 'reset') {
                                    dispatchHostBuzzerUpdate({
                                        roundQuestionId: activeQ,
                                        winnerPlayerId: null,
                                        source: 'realtime',
                                    })
                                    scheduleRefresh('buzzer_events:reset')
                                }

                                if (row.result === 'win' && (row.event_type === 'buzz' || row.event_type === 'steal')) {
                                    dispatchHostBuzzerUpdate({
                                        roundQuestionId: activeQ,
                                        winnerPlayerId: row.player_id ?? null,
                                        source: 'realtime',
                                    })
                                    scheduleRefresh('buzzer_events:win')
                                }
                            }

                            // Toast chỉ cho người nhanh nhất (cho cả INSERT/UPDATE -> win).
                            if (row.result !== 'win') return
                            if (!activeQ || row.round_question_id !== activeQ) return
                            toastWinnerOnce(row)
                        }
                    )

                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        reconnectAttemptsRef.current = 0
                        void hydrateExistingWinnerToast()
                        return
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.error('[HostRealtimeEventsListener] realtime error', { matchId, sessionId })
                        scheduleReconnect()
                    }
                    if (status === 'TIMED_OUT' || status === 'CLOSED') {
                        scheduleReconnect()
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
            void cleanupChannel()
        }
    }, [matchId, router, sessionId, toastWinnerOnce])

    return null
}
