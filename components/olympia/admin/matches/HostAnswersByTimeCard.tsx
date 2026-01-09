"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import getSupabase from '@/lib/supabase'
import { subscribeHostSessionUpdate } from '@/components/olympia/admin/matches/host-events'
import { Check, Timer, X } from 'lucide-react'

export type AnswerRow = {
    id: string
    player_id: string
    answer_text: string | null
    is_correct: boolean | null
    points_awarded: number | null
    submitted_at: string
    response_time_ms: number | null
}

export type PlayerRow = {
    id: string
    seat_index: number | null
    display_name: string | null
}

export type RoundQuestionSnapshot = {
    id: string
    target_player_id: string | null
}

export type Props = {
    matchId: string
    sessionId: string | null
    players: PlayerRow[]
    initialRoundQuestionId: string | null
    initialAnswers: AnswerRow[]
    isVcnv: boolean
    isTangToc: boolean
    confirmVcnvRowDecisionFormAction: (formData: FormData) => Promise<void>
}

export function HostAnswersByTimeCard(props: Props) {
    const {
        matchId,
        sessionId,
        players,
        initialRoundQuestionId,
        initialAnswers,
        isVcnv,
        isTangToc,
        confirmVcnvRowDecisionFormAction,
    } = props

    const [effectiveRoundQuestionId, setEffectiveRoundQuestionId] = useState<string | null>(initialRoundQuestionId)
    // Hiện chưa dùng trực tiếp, giữ lại nếu cần hiển thị trạng thái
    // const [effectiveQuestionState, setEffectiveQuestionState] = useState<string | null>(initialQuestionState)
    const [answers, setAnswers] = useState<AnswerRow[]>(initialAnswers)

    const supabaseRef = useRef<SupabaseClient | null>(null)
    const answersChannelRef = useRef<RealtimeChannel | null>(null)
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        return subscribeHostSessionUpdate((payload) => {
            if (payload.currentRoundQuestionId !== undefined) setEffectiveRoundQuestionId(payload.currentRoundQuestionId)
        })
    }, [])

    const hasLiveQuestion = useMemo(() => Boolean(sessionId && effectiveRoundQuestionId), [sessionId, effectiveRoundQuestionId])

    const refreshAnswers = useCallback(async () => {
        if (!matchId || !effectiveRoundQuestionId) {
            setAnswers([])
            return
        }
        try {
            const supabase = supabaseRef.current ?? (await getSupabase())
            supabaseRef.current = supabase
            const olympia = supabase.schema('olympia')
            const { data } = await olympia
                .from('answers')
                .select('id, player_id, answer_text, is_correct, points_awarded, submitted_at, response_time_ms')
                .eq('round_question_id', effectiveRoundQuestionId)
                .order('submitted_at', { ascending: true })
                .limit(50)
            setAnswers((data ?? []) as unknown as AnswerRow[])
        } catch {
            // ignore
        }
    }, [effectiveRoundQuestionId, matchId])

    useEffect(() => {
        let mounted = true

        const scheduleRefresh = () => {
            if (!mounted) return
            if (!effectiveRoundQuestionId) return
            if (refreshTimerRef.current) return
            refreshTimerRef.current = setTimeout(() => {
                refreshTimerRef.current = null
                void refreshAnswers()
            }, 200)
        }

        const subscribe = async () => {
            try {
                const supabase = supabaseRef.current ?? (await getSupabase())
                supabaseRef.current = supabase

                if (answersChannelRef.current) supabase.removeChannel(answersChannelRef.current)

                const ch = supabase
                    .channel(`olympia-host-answers-by-time-${matchId}`)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'answers', filter: `match_id=eq.${matchId}` },
                        (payload) => {
                            const row = (payload.new ?? payload.old) as { round_question_id?: string | null } | null
                            if (!row?.round_question_id || row.round_question_id !== effectiveRoundQuestionId) return
                            scheduleRefresh()
                        }
                    )

                ch.subscribe()
                answersChannelRef.current = ch

                if (pollTimerRef.current) clearInterval(pollTimerRef.current)
                pollTimerRef.current = setInterval(() => {
                    if (typeof document !== 'undefined' && document.hidden) return
                    void refreshAnswers()
                }, 2500)
            } catch {
                // ignore
            }
        }

        void subscribe()
        return () => {
            mounted = false
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current)
                refreshTimerRef.current = null
            }
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
    }, [effectiveRoundQuestionId, matchId, refreshAnswers])

    const sorted = useMemo(() => {
        const arr = answers.slice()
        arr.sort((a, b) => {
            const arm = typeof a.response_time_ms === 'number' ? a.response_time_ms : Number.MAX_SAFE_INTEGER
            const brm = typeof b.response_time_ms === 'number' ? b.response_time_ms : Number.MAX_SAFE_INTEGER
            if (arm !== brm) return arm - brm
            const at = Date.parse(a.submitted_at)
            const bt = Date.parse(b.submitted_at)
            return at - bt
        })
        return arr
    }, [answers])

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Đáp án</CardTitle>
                <CardDescription>
                    Thứ tự theo thời gian trả lời (response time). Ẩn thao tác ở vòng không áp dụng.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {!hasLiveQuestion ? (
                    <p className="text-xs text-muted-foreground">Chưa show câu hỏi.</p>
                ) : (
                    <div className="grid gap-2">
                        {players.map((p) => {
                            const row = sorted.find((a) => a.player_id === p.id) ?? null
                            const seatText = p.seat_index != null ? `Ghế ${p.seat_index}` : 'Ghế —'
                            const nameText = p.display_name ? ` · ${p.display_name}` : ''
                            const canScoreVcnv = isVcnv && row && row.is_correct == null
                            const labels = { correct: 'Đúng (+10)', wrong: 'Sai (0)', timeout: 'Hết giờ (0)' }
                            return (
                                <div key={p.id} className="rounded-md border bg-slate-50 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-medium">{seatText}{nameText}</p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={row?.is_correct ? 'default' : 'outline'}>
                                                {row?.is_correct == null ? '—' : row.is_correct ? 'Đúng' : 'Sai'}
                                            </Badge>
                                            <Badge variant="secondary">+{row?.points_awarded ?? 0}</Badge>
                                        </div>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm">
                                        {row?.answer_text?.trim() ? row.answer_text : <span className="text-muted-foreground">(Chưa có/Trống)</span>}
                                    </p>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        {typeof row?.response_time_ms === 'number' ? `${row.response_time_ms} ms` : '(chưa xác định thời gian)'}
                                    </p>
                                    {isTangToc ? (
                                        <p className="mt-2 text-xs text-muted-foreground">Tăng tốc: chấm tự động theo thứ tự thời gian.</p>
                                    ) : null}
                                    {canScoreVcnv ? (
                                        <div className="mt-3 grid grid-cols-3 gap-2">
                                            <form action={confirmVcnvRowDecisionFormAction} className="col-span-1">
                                                <input type="hidden" name="sessionId" value={sessionId ?? ''} />
                                                <input type="hidden" name="playerId" value={p.id} />
                                                <input type="hidden" name="decision" value="correct" />
                                                <Button type="submit" size="lg" className="w-full font-bold text-base" title={labels.correct} aria-label={labels.correct}>
                                                    <Check className="w-5 h-5 mr-1" /> Đúng
                                                </Button>
                                            </form>
                                            <form action={confirmVcnvRowDecisionFormAction} className="col-span-1">
                                                <input type="hidden" name="sessionId" value={sessionId ?? ''} />
                                                <input type="hidden" name="playerId" value={p.id} />
                                                <input type="hidden" name="decision" value="wrong" />
                                                <Button type="submit" size="lg" variant="outline" className="w-full font-bold text-base" title={labels.wrong} aria-label={labels.wrong}>
                                                    <X className="w-5 h-5 mr-1" /> Sai
                                                </Button>
                                            </form>
                                            <form action={confirmVcnvRowDecisionFormAction} className="col-span-1">
                                                <input type="hidden" name="sessionId" value={sessionId ?? ''} />
                                                <input type="hidden" name="playerId" value={p.id} />
                                                <input type="hidden" name="decision" value="timeout" />
                                                <Button type="submit" size="lg" variant="outline" className="w-full font-bold text-base" title={labels.timeout} aria-label={labels.timeout}>
                                                    <Timer className="w-5 h-5 mr-1" /> Hết giờ
                                                </Button>
                                            </form>
                                        </div>
                                    ) : null}
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
