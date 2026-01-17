'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import getSupabase from '@/lib/supabase'
import { dispatchHostBuzzerUpdate, dispatchHostSessionUpdate } from '@/components/olympia/admin/matches/host-events'
import { subscribeHostSessionUpdate } from '@/components/olympia/admin/matches/host-events'
import {
    estimateJsonPayloadBytes,
    getReceiveLagMs,
    traceHostReceive,
} from "@/lib/olympia/olympia-client-trace";


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
    current_round_id: string | null
    current_round_type: string | null
    current_round_question_id: string | null
    question_state: string | null
    timer_deadline: string | null
    buzzer_enabled: boolean | null
    show_scoreboard_overlay: boolean | null
    show_answers_overlay: boolean | null
}

type RealtimeEventPayload = Record<string, string | number | boolean | null>

type RealtimeEventRow = {
    id: string
    match_id: string
    session_id: string | null
    entity: string
    entity_id: string | null
    event_type: string
    payload: RealtimeEventPayload
    created_at: string
}

function payloadString(payload: RealtimeEventPayload, key: string): string | null {
    const value = payload[key]
    return typeof value === 'string' ? value : null
}

function payloadBoolean(payload: RealtimeEventPayload, key: string): boolean | null {
    const value = payload[key]
    return typeof value === 'boolean' ? value : null
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

    const hasSeenLiveSessionRef = useRef<boolean>(false)
    const currentRoundIdRef = useRef<string | null>(null)
    const currentRoundTypeRef = useRef<string | null>(null)

    const currentRoundQuestionIdRef = useRef<string | null>(null)
    useEffect(() => {
        currentRoundQuestionIdRef.current = currentRoundQuestionId
    }, [currentRoundQuestionId])

    // Đồng bộ activeQ/round ngay cả khi host đang optimistic và SSR chưa refresh kịp.
    useEffect(() => {
        return subscribeHostSessionUpdate((payload) => {
            if (payload.currentRoundQuestionId !== undefined) {
                currentRoundQuestionIdRef.current = payload.currentRoundQuestionId
            }
            if (payload.currentRoundId !== undefined) {
                currentRoundIdRef.current = payload.currentRoundId
            }
            if (payload.currentRoundType !== undefined) {
                currentRoundTypeRef.current = payload.currentRoundType
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
            queuedReasonsRef.current.add(reason)
            if (refreshTimerRef.current) return
            refreshTimerRef.current = setTimeout(() => {
                refreshTimerRef.current = null
                const reasons = Array.from(queuedReasonsRef.current)
                queuedReasonsRef.current.clear()
                console.debug('[HostRealtimeEventsListener] router.refresh', reasons)
                router.refresh()
            }, 40)
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
                            event: 'INSERT',
                            schema: 'olympia',
                            table: 'realtime_events',
                            filter: `match_id=eq.${matchId}`,
                        },
                        (payload: RealtimePostgresChangesPayload<RealtimeEventRow>) => {
                            const evt = (payload.new as RealtimeEventRow | null) ?? null
                            if (!evt || evt.match_id !== matchId) return

                            const commitTs = payload.commit_timestamp ?? null
                            const receiveLagMs = getReceiveLagMs(commitTs)
                            traceHostReceive({
                                event: `receive:realtime_events:${evt.entity}`,
                                fields: {
                                    matchId,
                                    sessionId: sessionId ?? null,
                                    eventType: evt.event_type,
                                    commitTs,
                                    receiveLagMs,
                                    payloadBytes: estimateJsonPayloadBytes(evt.payload),
                                },
                            })

                            if (evt.entity === 'live_sessions') {
                                if (sessionId && evt.session_id && evt.session_id !== sessionId) return

                                trackReason('live_sessions')
                                const liveSessionRow: LiveSessionRow = {
                                    id: payloadString(evt.payload, 'id') ?? (evt.session_id ?? ''),
                                    current_round_id: payloadString(evt.payload, 'currentRoundId'),
                                    current_round_type: payloadString(evt.payload, 'currentRoundType'),
                                    current_round_question_id: payloadString(evt.payload, 'currentRoundQuestionId'),
                                    question_state: payloadString(evt.payload, 'questionState'),
                                    timer_deadline: payloadString(evt.payload, 'timerDeadline'),
                                    buzzer_enabled: payloadBoolean(evt.payload, 'buzzerEnabled'),
                                    show_scoreboard_overlay: payloadBoolean(evt.payload, 'showScoreboardOverlay'),
                                    show_answers_overlay: payloadBoolean(evt.payload, 'showAnswersOverlay'),
                                }

                                const prevRoundId = currentRoundIdRef.current
                                const prevRoundType = currentRoundTypeRef.current

                                const hadBaseline = hasSeenLiveSessionRef.current
                                hasSeenLiveSessionRef.current = true

                                currentRoundIdRef.current = liveSessionRow.current_round_id
                                currentRoundTypeRef.current = liveSessionRow.current_round_type

                                dispatchHostSessionUpdate({
                                    currentRoundId: liveSessionRow.current_round_id,
                                    currentRoundType: liveSessionRow.current_round_type,
                                    currentRoundQuestionId: liveSessionRow.current_round_question_id,
                                    questionState: liveSessionRow.question_state,
                                    timerDeadline: liveSessionRow.timer_deadline,
                                    buzzerEnabled: liveSessionRow.buzzer_enabled,
                                    showScoreboardOverlay: liveSessionRow.show_scoreboard_overlay,
                                    showAnswersOverlay: liveSessionRow.show_answers_overlay,
                                    source: 'realtime',
                                })

                                const roundChanged =
                                    (prevRoundId ?? null) !== (liveSessionRow.current_round_id ?? null) ||
                                    (prevRoundType ?? null) !== (liveSessionRow.current_round_type ?? null)
                                if (hadBaseline && roundChanged) {
                                    scheduleRefresh('live_sessions:round_changed')
                                }
                                return
                            }

                            if (evt.entity === 'star_uses') {
                                trackReason('star_uses')
                                if (currentRoundTypeRef.current === 've_dich') {
                                    scheduleRefresh('star_uses')
                                }
                                return
                            }

                            if (evt.entity === 'answers') {
                                trackReason('answers')
                                return
                            }

                            if (evt.entity === 'buzzer_events') {
                                trackReason('buzzer_events')

                                const buzzerRow: BuzzerEventRow = {
                                    id: payloadString(evt.payload, 'id') ?? '',
                                    match_id: evt.match_id,
                                    round_question_id: payloadString(evt.payload, 'roundQuestionId'),
                                    player_id: payloadString(evt.payload, 'playerId'),
                                    result: payloadString(evt.payload, 'result'),
                                    event_type: payloadString(evt.payload, 'eventType'),
                                    occurred_at: payloadString(evt.payload, 'occurredAt'),
                                }

                                const activeQ = currentRoundQuestionIdRef.current
                                const sameQuestion = Boolean(activeQ && buzzerRow.round_question_id === activeQ)

                                if (sameQuestion && (evt.event_type === 'INSERT' || evt.event_type === 'UPDATE')) {
                                    if (evt.event_type === 'INSERT' && buzzerRow.event_type === 'reset') {
                                        dispatchHostBuzzerUpdate({
                                            roundQuestionId: activeQ,
                                            winnerPlayerId: null,
                                            source: 'realtime',
                                        })
                                    }

                                    if (
                                        buzzerRow.result === 'win' &&
                                        (buzzerRow.event_type === 'buzz' || buzzerRow.event_type === 'steal')
                                    ) {
                                        dispatchHostBuzzerUpdate({
                                            roundQuestionId: activeQ,
                                            winnerPlayerId: buzzerRow.player_id ?? null,
                                            source: 'realtime',
                                        })
                                    }
                                }

                                if (buzzerRow.result !== 'win') return
                                if (!activeQ || buzzerRow.round_question_id !== activeQ) return
                                toastWinnerOnce(buzzerRow)
                            }
                        }
                    )

                channel.subscribe((status: unknown) => {
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
