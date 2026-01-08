'use client'

import { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import getSupabase from '@/lib/supabase'
import type { AnswerRow, PlayerRow, LiveSessionRow } from '@/types/olympia/game'

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
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
            setAnswers((data ?? []) as unknown as AnswerRow[])
        } catch {
            // ignore
        }
    }, [currentQuestionId])

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
                        { event: '*', schema: 'olympia', table: 'answers', filter: `match_id=eq.${match.id}` },
                        (payload) => {
                            const row = (payload.new ?? payload.old) as { round_question_id?: string | null } | null
                            if (!row?.round_question_id || row.round_question_id !== currentQuestionId) return
                            void fetchAnswers()
                        }
                    )

                ch.subscribe()
                answersChannelRef.current = ch

                if (pollTimerRef.current) clearInterval(pollTimerRef.current)
                pollTimerRef.current = setInterval(() => {
                    if (typeof document !== 'undefined' && document.hidden) return
                    void fetchAnswers()
                }, 1000)
            } catch {
                // ignore
            }
        }

        void subscribe()
        return () => {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current)
                pollTimerRef.current = null
            }
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
                <div className="w-full max-w-4xl rounded-md border border-slate-700 bg-slate-950/70 p-6">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-200">Đáp án</p>
                            <p className="text-sm text-slate-100 truncate">{match.name}</p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-3">
                        {rows.length > 0 ? (
                            rows.map(({ player, answer, responseTimeMs }) => {
                                const seatText = player.seat_index != null ? `Ghế ${player.seat_index}` : 'Ghế —'
                                const nameText = player.display_name ? ` · ${player.display_name}` : ''
                                const responseTimeText =
                                    typeof responseTimeMs === 'number'
                                        ? `${(responseTimeMs / 1000).toFixed(2)} s`
                                        : '(chưa xác định)'

                                return (
                                    <div
                                        key={player.id}
                                        className="flex items-stretch justify-between gap-4 rounded-md border border-slate-700 bg-slate-950/50 overflow-hidden"
                                    >
                                        <div className="flex-1 min-w-0 px-5 py-4">
                                            <p className="text-sm font-medium text-slate-50 truncate">
                                                {seatText}{nameText}
                                            </p>
                                            <p className="mt-2 text-sm text-slate-200 line-clamp-2">
                                                {answer?.answer_text?.trim() ? (
                                                    answer.answer_text
                                                ) : (
                                                    <span className="text-muted-foreground">(Chưa nộp)</span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex flex-col items-end justify-center px-5 py-4 border-l border-slate-700/50">
                                            <p className="text-xs uppercase tracking-widest text-slate-200">Thời gian</p>
                                            <p className="text-sm font-mono text-white">{responseTimeText}</p>
                                        </div>
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
