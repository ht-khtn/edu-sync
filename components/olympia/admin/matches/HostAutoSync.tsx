'use client'

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import getSupabase from '@/lib/supabase'
import { dispatchHostSessionUpdate } from '@/components/olympia/admin/matches/host-events'

type Props = {
    sessionId: string | null
    currentRoundType: string | null
    currentRoundQuestionId: string | null
    questionState: string | null
}

type LiveSessionPatch = {
    current_round_type?: string | null
    current_round_question_id?: string | null
    question_state?: string | null
}

export function HostAutoSync({
    sessionId,
    currentRoundType,
    currentRoundQuestionId,
    questionState,
}: Props) {
    const channelRef = useRef<RealtimeChannel | null>(null)
    const lastServerSnapshotRef = useRef<Props>({
        sessionId: null,
        currentRoundType: null,
        currentRoundQuestionId: null,
        questionState: null,
    })
    const pendingEmitRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastEmitAtRef = useRef<number>(0)
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const retryCountRef = useRef<number>(0)

    // Keep latest server snapshot for change detection.
    useEffect(() => {
        lastServerSnapshotRef.current = {
            sessionId,
            currentRoundType,
            currentRoundQuestionId,
            questionState,
        }
    }, [sessionId, currentRoundType, currentRoundQuestionId, questionState])

    useEffect(() => {
        let mounted = true

        const clearTimers = () => {
            if (pendingEmitRef.current) {
                clearTimeout(pendingEmitRef.current)
                pendingEmitRef.current = null
            }
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current)
                retryTimerRef.current = null
            }
        }

        const scheduleEmit = (reason: string, payload: { nextRqId: string | null; nextQs: string | null }) => {
            // Throttle emit để tránh bắn liên tục.
            const now = Date.now()
            const elapsed = now - lastEmitAtRef.current
            const delay = elapsed < 300 ? 300 - elapsed : 80

            if (pendingEmitRef.current) return
            pendingEmitRef.current = setTimeout(() => {
                pendingEmitRef.current = null
                lastEmitAtRef.current = Date.now()
                console.debug('[HostAutoSync] emit host session update', reason)
                dispatchHostSessionUpdate({
                    currentRoundQuestionId: payload.nextRqId,
                    questionState: payload.nextQs,
                    source: 'realtime',
                })
            }, delay)
        }

        const subscribe = async () => {
            if (!sessionId) return

            try {
                const supabase = await getSupabase()
                if (!mounted) return

                // Cleanup previous channel if any.
                if (channelRef.current) {
                    try {
                        supabase.removeChannel(channelRef.current)
                    } catch {
                        channelRef.current.unsubscribe()
                    }
                    channelRef.current = null
                }

                const channel = supabase
                    .channel(`olympia-host-sync-${sessionId}`)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'live_sessions', filter: `id=eq.${sessionId}` },
                        (payload) => {
                            const patch = (payload.new ?? payload.old) as LiveSessionPatch | null
                            if (!patch) return

                            const snap = lastServerSnapshotRef.current
                            const nextRoundType = patch.current_round_type ?? snap.currentRoundType
                            const nextRqId = patch.current_round_question_id ?? snap.currentRoundQuestionId
                            const nextQs = patch.question_state ?? snap.questionState

                            const changed =
                                nextRoundType !== snap.currentRoundType ||
                                nextRqId !== snap.currentRoundQuestionId ||
                                nextQs !== snap.questionState

                            if (changed) {
                                scheduleEmit('live_sessions changed', { nextRqId, nextQs })
                            }
                        }
                    )

                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        retryCountRef.current = 0
                        return
                    }
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        const nextCount = Math.min(retryCountRef.current + 1, 6)
                        retryCountRef.current = nextCount
                        const delayMs = Math.min(10000, 500 * Math.pow(2, nextCount))
                        if (retryTimerRef.current) return
                        retryTimerRef.current = setTimeout(() => {
                            retryTimerRef.current = null
                            if (!mounted) return
                            void subscribe()
                        }, delayMs)
                    }
                })

                channelRef.current = channel
            } catch {
                // ignore: host can still work with manual refresh
            }
        }

        void subscribe()

        return () => {
            mounted = false
            clearTimers()

            const supabaseCleanup = async () => {
                const supabase = await getSupabase()
                const channel = channelRef.current
                if (!channel) return
                try {
                    supabase.removeChannel(channel)
                } catch {
                    channel.unsubscribe()
                }
                if (channelRef.current === channel) channelRef.current = null
            }

            void supabaseCleanup()
        }
    }, [sessionId])

    return null
}
