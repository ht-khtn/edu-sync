'use client'

import { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import getSupabase from '@/lib/supabase'
import type { AnswerRow, PlayerRow, LiveSessionRow } from '@/types/olympia/game'
import OlympiaQuestionFrame from '@/components/olympia/shared/game/OlympiaQuestionFrame'

type JsonValue =
    | string
    | number
    | boolean
    | null
    | { [key: string]: JsonValue }
    | JsonValue[]

type RealtimeEventPayload = Record<string, JsonValue>

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

function payloadNumber(payload: RealtimeEventPayload, key: string): number | null {
    const value = payload[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function payloadBoolean(payload: RealtimeEventPayload, key: string): boolean | null {
    const value = payload[key]
    return typeof value === 'boolean' ? value : null
}

type Props = {
    session: LiveSessionRow
    match: { id: string; name: string }
    players: PlayerRow[]
    scores: Array<{ id: string; player_id: string; points: number | null }> | null
    embedded?: boolean
}

export function AnswersOverlay({ session, match, players, embedded }: Props) {
    const [answers, setAnswers] = useState<AnswerRow[]>([])
    const supabaseRef = useRef<SupabaseClient | null>(null)
    const answersChannelRef = useRef<RealtimeChannel | null>(null)

    const currentQuestionId = session.current_round_question_id

    const fetchAnswers = useCallback(async () => {
        if (!currentQuestionId) {
            setAnswers([])
            return
        }
        try {
            const supabase = supabaseRef.current ?? (await getSupabase())
            supabaseRef.current = supabase
            const olympia = supabase.schema('olympia')
            const { data } = await olympia
                .from('answers')
                .select('id, match_id, player_id, answer_text, is_correct, points_awarded, response_time_ms, submitted_at')
                .eq('round_question_id', currentQuestionId)
                .order('response_time_ms', { ascending: true, nullsFirst: false })
                .limit(50)
            setAnswers((data ?? []) as AnswerRow[])
        } catch {
            // ignore
        }
    }, [currentQuestionId])

    useEffect(() => {
        void fetchAnswers()
    }, [fetchAnswers])

    useEffect(() => {
        const subscribe = async () => {
            try {
                const supabase = supabaseRef.current ?? (await getSupabase())
                supabaseRef.current = supabase

                if (answersChannelRef.current) supabase.removeChannel(answersChannelRef.current)

                const ch = supabase
                    .channel(`olympia-answers-overlay-${session.id}`)
                    .on(
                        'postgres_changes',
                        { event: 'INSERT', schema: 'olympia', table: 'realtime_events', filter: `match_id=eq.${match.id}` },
                        (payload) => {
                            const evt = (payload.new ?? null) as RealtimeEventRow | null
                            if (!evt || evt.match_id !== match.id) return
                            if (evt.entity !== 'answers') return

                            const rqId = payloadString(evt.payload, 'roundQuestionId')
                            if (!rqId || rqId !== currentQuestionId) return

                            const id = payloadString(evt.payload, 'id')
                            const playerId = payloadString(evt.payload, 'playerId')
                            const submittedAt = payloadString(evt.payload, 'submittedAt')
                            if (!id || !playerId || !submittedAt) return

                            const row: AnswerRow = {
                                id,
                                match_id: match.id,
                                round_question_id: rqId,
                                player_id: playerId,
                                answer_text: payloadString(evt.payload, 'answerText'),
                                is_correct: payloadBoolean(evt.payload, 'isCorrect'),
                                points_awarded: payloadNumber(evt.payload, 'pointsAwarded'),
                                response_time_ms: payloadNumber(evt.payload, 'responseTimeMs'),
                                submitted_at: submittedAt,
                            }

                            setAnswers((prev) => {
                                if (evt.event_type === 'DELETE') return prev.filter((a) => a.id !== row.id)
                                const idx = prev.findIndex((a) => a.id === row.id)
                                if (idx === -1) return [...prev, row]
                                const next = prev.slice()
                                next[idx] = { ...next[idx], ...row }
                                return next
                            })
                        }
                    )

                ch.subscribe()
                answersChannelRef.current = ch
            } catch {
                // ignore
            }
        }

        void subscribe()
        return () => {
            try {
                const supabase = supabaseRef.current
                if (supabase && answersChannelRef.current) supabase.removeChannel(answersChannelRef.current)
            } catch {
                try { answersChannelRef.current?.unsubscribe() } catch { }
            } finally {
                answersChannelRef.current = null
            }
        }
    }, [currentQuestionId, match.id, fetchAnswers, session.id])

    // Sắp xếp theo response_time_ms (nhanh nhất lên trên)
    const sorted = useMemo(() => {
        const arr = answers.slice()
        arr.sort((a, b) => {
            const arm = typeof a.response_time_ms === 'number' ? a.response_time_ms : Number.MAX_SAFE_INTEGER
            const brm = typeof b.response_time_ms === 'number' ? b.response_time_ms : Number.MAX_SAFE_INTEGER
            return arm - brm
        })
        return arr
    }, [answers])

    const rows = useMemo(() => {
        // Lấy câu trả lời theo từng thí sinh (ưu tiên cái có response_time_ms nhỏ nhất).
        const answerByPlayerId = new Map<string, AnswerRow>()
        for (const a of sorted) {
            if (!answerByPlayerId.has(a.player_id)) answerByPlayerId.set(a.player_id, a)
        }

        const list = players.map((p) => {
            const answer = answerByPlayerId.get(p.id) ?? null
            const responseTimeMs = typeof answer?.response_time_ms === 'number' ? answer.response_time_ms : null
            return { player: p, answer, responseTimeMs }
        })

        list.sort((ra, rb) => {
            const aMs = ra.responseTimeMs ?? Number.MAX_SAFE_INTEGER
            const bMs = rb.responseTimeMs ?? Number.MAX_SAFE_INTEGER
            if (aMs !== bMs) return aMs - bMs
            const aSeat = ra.player.seat_index ?? Number.MAX_SAFE_INTEGER
            const bSeat = rb.player.seat_index ?? Number.MAX_SAFE_INTEGER
            return aSeat - bSeat
        })
        return list
    }, [players, sorted])

    return (
        <div className={embedded ? 'absolute inset-0 z-[60]' : 'fixed inset-0 z-[60]'}>
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `url('/olympia-theme/Result.png')`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: '#000',
                }}
            />
            <div className="relative z-10 h-full w-full flex items-center justify-center px-4">
                <div className="w-full max-w-6xl rounded-md border border-slate-700 bg-slate-950/70 p-6">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-200">Đáp án</p>
                            <p className="text-sm text-slate-100 truncate">{match.name}</p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 grid-cols-1">
                        {rows.length > 0 ? (
                            rows.map(({ player, answer, responseTimeMs }, index) => {
                                const seatText = player.seat_index != null ? `Ghế ${player.seat_index}` : 'Ghế —'
                                const nameText = player.display_name ? ` · ${player.display_name}` : ''
                                const responseTimeText =
                                    typeof responseTimeMs === 'number'
                                        ? `${(responseTimeMs / 1000).toFixed(2)} s`
                                        : '(chưa xác định)'

                                return (
                                    <div key={player.id} className="w-full h-[170px] sm:h-[190px]">
                                        <OlympiaQuestionFrame
                                            embedded
                                            open
                                            playIntro
                                            showScoreboardStrip={false}
                                            introDelaySeconds={index * 0.22}
                                            contentClassName="w-full h-full px-8 text-left text-white pointer-events-auto"
                                        >
                                            <div className="h-full w-full flex flex-col justify-center">
                                                <div className="flex items-start justify-between gap-6">
                                                    <div className="min-w-0">
                                                        <p className="text-lg font-semibold truncate">{seatText}{nameText}</p>
                                                        <p className="mt-2 text-base text-slate-100/90 line-clamp-2">
                                                            {answer?.answer_text?.trim() ? (
                                                                answer.answer_text
                                                            ) : (
                                                                <span className="text-slate-300">(Chưa nộp)</span>
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="shrink-0 text-right">
                                                        <p className="text-xs uppercase tracking-widest text-slate-200">Thời gian</p>
                                                        <p className="mt-1 text-base font-mono text-white">{responseTimeText}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </OlympiaQuestionFrame>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="text-center text-slate-200">Chưa có dữ liệu đáp án.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
