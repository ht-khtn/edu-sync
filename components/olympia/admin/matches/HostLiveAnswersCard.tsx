'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import getSupabase from '@/lib/supabase'
import { subscribeHostBuzzerUpdate, subscribeHostSessionUpdate } from '@/components/olympia/admin/matches/host-events'
import { Check, Loader2, Timer, X } from 'lucide-react'

type DecisionValue = 'correct' | 'wrong' | 'timeout'

type BatchDecision = {
    playerId: string
    decision: DecisionValue
}

type HostSnapshotRoundQuestion = {
    id: string
    target_player_id: string | null
    meta: Record<string, unknown> | null
}

type HostSnapshotAnswer = {
    id: string
    player_id: string
    answer_text: string | null
    is_correct: boolean | null
    points_awarded: number | null
    submitted_at: string
}

type HostSnapshotResponse = {
    currentRoundQuestionId: string | null
    questionState: string | null
    winnerPlayerId: string | null
    roundQuestion: HostSnapshotRoundQuestion | null
    answers: HostSnapshotAnswer[]
}

type PlayerRow = {
    id: string
    seat_index: number | null
    display_name: string | null
    is_disqualified_obstacle?: boolean | null
}

type AnswerRow = {
    id: string
    player_id: string
    answer_text: string | null
    is_correct: boolean | null
    points_awarded: number | null
    submitted_at: string
}

type RoundQuestionSnapshot = {
    id: string
    target_player_id: string | null
    meta: Record<string, unknown> | null
}

type HostControlAction = (formData: FormData) => Promise<void>

type Props = {
    matchId: string
    sessionId: string | null

    initialRoundQuestionId: string | null
    initialQuestionState: string | null
    initialWinnerBuzzPlayerId: string | null

    initialAnswers: AnswerRow[]
    initialRoundQuestion: RoundQuestionSnapshot | null

    players: PlayerRow[]

    isKhoiDong: boolean
    isVcnv: boolean
    isTangToc: boolean
    isVeDich: boolean

    confirmDecisionVoidFormAction: HostControlAction
    confirmVcnvRowDecisionFormAction: HostControlAction
    confirmDecisionsBatchFormAction: HostControlAction
}

function getMetaCode(meta: Record<string, unknown> | null | undefined): string | null {
    if (!meta) return null
    const code = meta.code
    return typeof code === 'string' && code.trim() ? code : null
}

function getKhoiDongCodeInfo(code: string | null): { kind: 'personal'; seat: number } | { kind: 'common' } | null {
    if (!code) return null
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return null

    if (trimmed.startsWith('DKA-')) {
        return { kind: 'common' }
    }

    const m = /^KD(\d+)-/i.exec(trimmed)
    if (!m) return null
    const seat = Number(m[1])
    if (!Number.isFinite(seat)) return null
    return { kind: 'personal', seat }
}

export function HostLiveAnswersCard({
    matchId,
    sessionId,
    initialRoundQuestionId,
    initialQuestionState,
    initialWinnerBuzzPlayerId,
    initialAnswers,
    initialRoundQuestion,
    players,
    isKhoiDong,
    isVcnv,
    isTangToc,
    isVeDich,
    confirmDecisionVoidFormAction,
    confirmVcnvRowDecisionFormAction,
    confirmDecisionsBatchFormAction,
}: Props) {
    const [isPending, startTransition] = useTransition()
    const [effectiveRoundQuestionId, setEffectiveRoundQuestionId] = useState<string | null>(initialRoundQuestionId)
    const [effectiveQuestionState, setEffectiveQuestionState] = useState<string | null>(initialQuestionState)
    const [effectiveWinnerBuzzPlayerId, setEffectiveWinnerBuzzPlayerId] = useState<string | null>(
        initialWinnerBuzzPlayerId
    )

    const [effectivePlayers, setEffectivePlayers] = useState<PlayerRow[]>(players)
    const [answers, setAnswers] = useState<AnswerRow[]>(initialAnswers)
    const [roundQuestion, setRoundQuestion] = useState<RoundQuestionSnapshot | null>(initialRoundQuestion)

    const [batchEnabled, setBatchEnabled] = useState(false)
    const [batchDecisions, setBatchDecisions] = useState<BatchDecision[]>([])

    const supabaseRef = useRef<SupabaseClient | null>(null)
    const answersChannelRef = useRef<RealtimeChannel | null>(null)
    const playersChannelRef = useRef<RealtimeChannel | null>(null)

    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const effectiveRoundQuestionIdRef = useRef<string | null>(initialRoundQuestionId)
    useEffect(() => {
        effectiveRoundQuestionIdRef.current = effectiveRoundQuestionId
    }, [effectiveRoundQuestionId])

    useEffect(() => {
        setEffectivePlayers(players)
    }, [players])

    useEffect(() => {
        // Khi đổi câu, reset danh sách chấm batch để tránh chấm nhầm.
        setBatchDecisions([])
    }, [effectiveRoundQuestionId])

    useEffect(() => {
        // Đồng bộ theo host-events để không phụ thuộc router.refresh.
        return subscribeHostSessionUpdate((payload) => {
            if (payload.currentRoundQuestionId !== undefined) {
                setEffectiveRoundQuestionId(payload.currentRoundQuestionId)
            }
            if (payload.questionState !== undefined) {
                setEffectiveQuestionState(payload.questionState)
            }
        })
    }, [])

    useEffect(() => {
        return subscribeHostBuzzerUpdate((payload) => {
            const rqId = effectiveRoundQuestionIdRef.current
            if (!rqId) return
            if (payload.roundQuestionId !== rqId) return
            setEffectiveWinnerBuzzPlayerId(payload.winnerPlayerId ?? null)
        })
    }, [])

    const refreshSnapshot = useCallback(async (why: string) => {
        if (!matchId || !sessionId) {
            return
        }

        try {
            const url = new URL('/api/olympia/host/snapshot', window.location.origin)
            url.searchParams.set('matchId', matchId)
            url.searchParams.set('sessionId', sessionId)

            const resp = await fetch(url.toString(), { cache: 'no-store' })
            if (!resp.ok) return

            const json = (await resp.json()) as HostSnapshotResponse

            if (json.currentRoundQuestionId !== undefined) {
                setEffectiveRoundQuestionId(json.currentRoundQuestionId)
                effectiveRoundQuestionIdRef.current = json.currentRoundQuestionId
            }
            if (json.questionState !== undefined) {
                setEffectiveQuestionState(json.questionState)
            }
            if (json.winnerPlayerId !== undefined) {
                setEffectiveWinnerBuzzPlayerId(json.winnerPlayerId)
            }
            if (json.roundQuestion !== undefined) {
                setRoundQuestion(json.roundQuestion as unknown as RoundQuestionSnapshot | null)
            }
            if (Array.isArray(json.answers)) {
                setAnswers(json.answers as unknown as AnswerRow[])
            }
        } catch {
            // ignore
        } finally {
            void why
        }
    }, [matchId, sessionId])

    const hasLiveQuestion = useMemo(() => Boolean(sessionId && effectiveRoundQuestionId), [effectiveRoundQuestionId, sessionId])

    const refreshAnswers = useCallback(async (why: string) => {
        // Ưu tiên snapshot server-side (ổn định hơn, tránh RLS/realtime phía browser).
        await refreshSnapshot(`answers:${why}`)

        const rqId = effectiveRoundQuestionIdRef.current
        if (!matchId || !rqId) {
            setAnswers([])
            return
        }

        try {
            const supabase = supabaseRef.current ?? (await getSupabase())
            supabaseRef.current = supabase
            const olympia = supabase.schema('olympia')
            const { data } = await olympia
                .from('answers')
                .select('id, player_id, answer_text, is_correct, points_awarded, submitted_at')
                .eq('round_question_id', rqId)
                .order('submitted_at', { ascending: false })
                .limit(50)
            if (!data) return

            setAnswers(data as unknown as AnswerRow[])
        } catch {
            // ignore
        } finally {
            void why
        }
    }, [matchId, refreshSnapshot])

    const refreshRoundQuestion = useCallback(async () => {
        // Ưu tiên snapshot server-side.
        await refreshSnapshot('round_question')

        const rqId = effectiveRoundQuestionIdRef.current
        if (!matchId || !rqId) {
            setRoundQuestion(null)
            return
        }

        try {
            const supabase = supabaseRef.current ?? (await getSupabase())
            supabaseRef.current = supabase
            const olympia = supabase.schema('olympia')
            const { data } = await olympia
                .from('round_questions')
                .select('id, target_player_id, meta')
                .eq('id', rqId)
                .maybeSingle()
            setRoundQuestion((data as unknown as RoundQuestionSnapshot | null) ?? null)
        } catch {
            // ignore
        }
    }, [matchId, refreshSnapshot])

    // Khi đổi câu hỏi: fetch lại round_question + answers.
    useEffect(() => {
        effectiveRoundQuestionIdRef.current = effectiveRoundQuestionId
        void refreshRoundQuestion()
        void refreshAnswers('question changed')
    }, [effectiveRoundQuestionId, refreshAnswers, refreshRoundQuestion])

    useEffect(() => {
        let mounted = true

        const scheduleRefresh = (reason: string) => {
            if (!mounted) return
            if (typeof document !== 'undefined' && document.hidden) return
            if (!effectiveRoundQuestionIdRef.current) return
            if (refreshTimerRef.current) return
            refreshTimerRef.current = setTimeout(() => {
                refreshTimerRef.current = null
                void refreshAnswers(reason)
            }, 200)
        }

        const cleanup = async () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current)
                refreshTimerRef.current = null
            }
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current)
                pollTimerRef.current = null
            }

            try {
                const supabase = supabaseRef.current ?? (await getSupabase())
                if (answersChannelRef.current) supabase.removeChannel(answersChannelRef.current)
                if (playersChannelRef.current) supabase.removeChannel(playersChannelRef.current)
            } catch {
                try {
                    answersChannelRef.current?.unsubscribe()
                    playersChannelRef.current?.unsubscribe()
                } catch {
                    // ignore
                }
            } finally {
                answersChannelRef.current = null
                playersChannelRef.current = null
            }
        }

        const subscribe = async () => {
            try {
                const supabase = supabaseRef.current ?? (await getSupabase())
                supabaseRef.current = supabase

                // Cleanup trước.
                if (answersChannelRef.current) {
                    try {
                        supabase.removeChannel(answersChannelRef.current)
                    } catch {
                        answersChannelRef.current.unsubscribe()
                    }
                    answersChannelRef.current = null
                }
                if (playersChannelRef.current) {
                    try {
                        supabase.removeChannel(playersChannelRef.current)
                    } catch {
                        playersChannelRef.current.unsubscribe()
                    }
                    playersChannelRef.current = null
                }

                const answersChannel = supabase
                    .channel(`olympia-host-answers-${matchId}`)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'answers', filter: `match_id=eq.${matchId}` },
                        (payload) => {
                            const row = (payload.new ?? payload.old) as { round_question_id?: string | null } | null
                            const rqId = effectiveRoundQuestionIdRef.current
                            if (!rqId) return
                            if (!row?.round_question_id || row.round_question_id !== rqId) return
                            scheduleRefresh('answers changed')
                        }
                    )

                answersChannel.subscribe()
                answersChannelRef.current = answersChannel

                const playersChannel = supabase
                    .channel(`olympia-host-players-${matchId}`)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'olympia', table: 'match_players', filter: `match_id=eq.${matchId}` },
                        () => {
                            // Không optimize incremental để tránh sai type; refetch nhẹ.
                            void (async () => {
                                try {
                                    const olympia = supabase.schema('olympia')
                                    const { data } = await olympia
                                        .from('match_players')
                                        .select('id, seat_index, display_name, is_disqualified_obstacle')
                                        .eq('match_id', matchId)
                                        .order('seat_index', { ascending: true })
                                    if (!data) return
                                    if (!mounted) return
                                    setEffectivePlayers(data as unknown as PlayerRow[])
                                } catch {
                                    // ignore
                                }
                            })()
                        }
                    )

                playersChannel.subscribe()
                playersChannelRef.current = playersChannel

                // Poll snapshot: đảm bảo host thấy đáp án/buzzer/đổi câu mà không cần reload.
                if (pollTimerRef.current) clearInterval(pollTimerRef.current)
                pollTimerRef.current = setInterval(() => {
                    if (typeof document !== 'undefined' && document.hidden) return
                    void refreshSnapshot('poll')
                }, 2000)
            } catch {
                // ignore
            }
        }

        void subscribe()

        return () => {
            mounted = false
            void cleanup()
        }
    }, [matchId, refreshAnswers, refreshSnapshot])

    const latestByPlayer = useMemo(() => {
        const out = new Map<string, AnswerRow>()
        for (const a of answers) {
            if (!a.player_id) continue
            if (!out.has(a.player_id)) out.set(a.player_id, a)
        }
        return out
    }, [answers])

    const enabledScoringPlayerId = useMemo(() => {
        if (!hasLiveQuestion) return null

        if (isKhoiDong) {
            const codeInfo = getKhoiDongCodeInfo(getMetaCode(roundQuestion?.meta))
            if (codeInfo?.kind === 'common') return effectiveWinnerBuzzPlayerId ?? null
            if (codeInfo?.kind === 'personal') {
                const pid =
                    effectivePlayers.find((p) => p.seat_index === codeInfo.seat)?.id ??
                    effectivePlayers.find((p) => p.seat_index === codeInfo.seat - 1)?.id ??
                    null
                if (pid) return pid
                if (roundQuestion?.target_player_id) return roundQuestion.target_player_id
                return effectiveWinnerBuzzPlayerId ?? null
            }
            return effectiveWinnerBuzzPlayerId ?? null
        }

        if (isVeDich) return roundQuestion?.target_player_id ?? null

        return null
    }, [effectivePlayers, effectiveWinnerBuzzPlayerId, hasLiveQuestion, isKhoiDong, isVeDich, roundQuestion?.meta, roundQuestion?.target_player_id])

    const allowAllPlayers = useMemo(() => {
        return hasLiveQuestion && !isTangToc && !isKhoiDong && !isVeDich
    }, [hasLiveQuestion, isKhoiDong, isTangToc, isVeDich])

    const scoringUnlocked = useMemo(() => {
        if (!hasLiveQuestion) return false
        if (effectiveQuestionState !== 'showing') return false

        if (isVcnv) return true

        if (isTangToc) return true

        if (isKhoiDong) {
            const codeInfo = getKhoiDongCodeInfo(getMetaCode(roundQuestion?.meta))
            if (codeInfo?.kind === 'personal') return true
            return Boolean(effectiveWinnerBuzzPlayerId)
        }

        // Các trường hợp khác: giữ rule hiện tại (chỉ mở khi có winner).
        return Boolean(effectiveWinnerBuzzPlayerId)
    }, [effectiveQuestionState, effectiveWinnerBuzzPlayerId, hasLiveQuestion, isKhoiDong, isTangToc, isVcnv, roundQuestion?.meta])

    const scoringHint = useMemo(() => {
        if (!hasLiveQuestion) return 'Chưa show câu hỏi.'
        if (isTangToc) {
            return batchEnabled
                ? 'Tăng tốc: chấm theo thứ tự host chấm (Đúng trước: 40/30/20/10; Sai/Hết giờ: 0 và không tính thứ tự).'
                : 'Tăng tốc: bật “Chấm cùng lúc” để chấm theo thứ tự host chấm (40/30/20/10).'
        }
        if (isKhoiDong) {
            const info = getKhoiDongCodeInfo(getMetaCode(roundQuestion?.meta))
            if (info?.kind === 'personal') return `Khởi động · Thi riêng: chỉ chấm cho Ghế ${info.seat}. (Sai/Hết giờ: 0 điểm)`
            return effectiveWinnerBuzzPlayerId
                ? 'Khởi động · Thi chung: chỉ chấm cho thí sinh bấm chuông thắng. (Sai/Hết giờ: -5, không âm)'
                : 'Khởi động · Thi chung: chờ thí sinh bấm chuông thắng để chấm.'
        }
        if (isVeDich) return 'Về đích: chỉ chấm cho thí sinh chính.'
        if (isVcnv) return 'VCNV: đúng +10, sai/hết giờ 0.'
        return 'Chấm điểm theo luật vòng hiện tại.'
    }, [batchEnabled, effectiveWinnerBuzzPlayerId, hasLiveQuestion, isKhoiDong, isTangToc, isVcnv, isVeDich, roundQuestion?.meta])

    const queueBatchDecision = useCallback((playerId: string, decision: DecisionValue) => {
        setBatchDecisions((prev) => {
            // Giữ thứ tự click: click lại cùng 1 thí sinh sẽ đưa quyết định lên cuối.
            const next = prev.filter((x) => x.playerId !== playerId)
            next.push({ playerId, decision })
            return next
        })
    }, [])

    const batchDecisionByPlayerId = useMemo(() => {
        const map = new Map<string, DecisionValue>()
        for (const item of batchDecisions) {
            map.set(item.playerId, item.decision)
        }
        return map
    }, [batchDecisions])

    const batchItemsJson = useMemo(() => {
        // Server action sẽ parse JSON này theo đúng thứ tự.
        return JSON.stringify(batchDecisions)
    }, [batchDecisions])

    const getDecisionLabels = (playerId: string) => {
        void playerId
        if (isVcnv) return { correct: 'Đúng (+10)', wrong: 'Sai (0)', timeout: 'Hết giờ (0)' }
        if (isKhoiDong) {
            const info = getKhoiDongCodeInfo(getMetaCode(roundQuestion?.meta))
            const isPersonal = info?.kind === 'personal'
            return {
                correct: 'Đúng (+10)',
                wrong: isPersonal ? 'Sai (0)' : 'Sai (-5)',
                timeout: isPersonal ? 'Hết giờ (0)' : 'Hết giờ (-5)',
            }
        }
        if (isVeDich) return { correct: 'Đúng', wrong: 'Sai', timeout: 'Hết giờ' }
        return { correct: 'Đúng', wrong: 'Sai', timeout: 'Hết giờ' }
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle className="text-base">Câu trả lời</CardTitle>
                        <CardDescription>
                            Câu trả lời của thí sinh cho câu đang live. Khung này cập nhật realtime/poll (không cần tải lại trang).
                        </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm">Chấm cùng lúc</span>
                        <Switch
                            checked={batchEnabled}
                            onCheckedChange={(checked) => {
                                setBatchEnabled(checked)
                                if (!checked) setBatchDecisions([])
                            }}
                            aria-label="Chấm cùng lúc"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{scoringHint}</p>

                    {batchEnabled ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">Đã lưu {batchDecisions.length} quyết định.</p>
                            <form
                                action={(formData) => {
                                    startTransition(async () => {
                                        await confirmDecisionsBatchFormAction(formData)
                                        setBatchDecisions([])
                                        // Refresh dữ liệu ngay sau khi submit batch để cập nhật UI
                                        setTimeout(() => {
                                            void refreshAnswers('batch submitted')
                                        }, 100)
                                    })
                                }}
                                className="flex items-center gap-2"
                            >
                                <input type="hidden" name="sessionId" value={sessionId ?? ''} />
                                <input type="hidden" name="itemsJson" value={batchItemsJson} />
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={!sessionId || batchDecisions.length === 0 || isPending}
                                >
                                    Chấm điểm
                                </Button>
                            </form>
                        </div>
                    ) : null}

                    <div className="grid gap-2">
                        {effectivePlayers.map((pl) => {
                            const latest = latestByPlayer.get(pl.id) ?? null
                            const isObstacleDisqualified = isVcnv && pl.is_disqualified_obstacle === true

                            const labels = getDecisionLabels(pl.id)

                            const isAlreadyScoredForVcnv =
                                isVcnv && latest?.is_correct !== null && latest?.is_correct !== undefined

                            const canScore =
                                Boolean(
                                    hasLiveQuestion &&
                                    scoringUnlocked &&
                                    (!isTangToc || batchEnabled) &&
                                    (allowAllPlayers ||
                                        isTangToc ||
                                        (enabledScoringPlayerId && enabledScoringPlayerId === pl.id))
                                ) &&
                                !isObstacleDisqualified &&
                                !isAlreadyScoredForVcnv

                            const seatText = pl.seat_index != null ? `Ghế ${pl.seat_index}` : 'Ghế —'
                            const nameText = pl.display_name ? ` · ${pl.display_name}` : ''

                            const decisionFormAction = isVcnv
                                ? confirmVcnvRowDecisionFormAction
                                : confirmDecisionVoidFormAction

                            const selectedBatchDecision = batchDecisionByPlayerId.get(pl.id) ?? null

                            return (
                                <div key={pl.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-medium">
                                            {seatText}
                                            {nameText}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant={latest?.is_correct ? 'default' : 'outline'}>
                                                {latest?.is_correct == null
                                                    ? '—'
                                                    : latest.is_correct
                                                        ? 'Đúng'
                                                        : 'Sai'}
                                            </Badge>
                                            <Badge variant="secondary">+{latest?.points_awarded ?? 0}</Badge>
                                        </div>
                                    </div>

                                    <p className="mt-2 whitespace-pre-wrap text-sm">
                                        {latest?.answer_text?.trim() ? (
                                            latest.answer_text
                                        ) : (
                                            <span className="text-muted-foreground">(Chưa có/Trống)</span>
                                        )}
                                    </p>

                                    {isObstacleDisqualified ? (
                                        <p className="mt-2 text-xs text-amber-700">
                                            Đã bị loại quyền CNV ở vòng này (không thể gửi đáp án / không chấm điểm).
                                        </p>
                                    ) : null}

                                    {isAlreadyScoredForVcnv ? (
                                        <p className="mt-2 text-xs text-muted-foreground">Đã chấm (VCNV).</p>
                                    ) : null}

                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {batchEnabled ? (
                                            <>
                                                <Button
                                                    type="button"
                                                    size="lg"
                                                    className="w-full font-bold text-base disabled:opacity-40"
                                                    variant={selectedBatchDecision === 'correct' ? 'default' : 'outline'}
                                                    disabled={!canScore || isPending}
                                                    title={labels.correct}
                                                    aria-label={labels.correct}
                                                    onClick={() => queueBatchDecision(pl.id, 'correct')}
                                                >
                                                    <Check className="w-5 h-5 mr-1" />
                                                    Đúng
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="lg"
                                                    className="w-full font-bold text-base disabled:opacity-40"
                                                    variant={selectedBatchDecision === 'wrong' ? 'default' : 'outline'}
                                                    disabled={!canScore || isPending}
                                                    title={labels.wrong}
                                                    aria-label={labels.wrong}
                                                    onClick={() => queueBatchDecision(pl.id, 'wrong')}
                                                >
                                                    <X className="w-5 h-5 mr-1" />
                                                    Sai
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="lg"
                                                    className="w-full font-bold text-base disabled:opacity-40"
                                                    variant={selectedBatchDecision === 'timeout' ? 'default' : 'outline'}
                                                    disabled={!canScore || isPending}
                                                    title={labels.timeout}
                                                    aria-label={labels.timeout}
                                                    onClick={() => queueBatchDecision(pl.id, 'timeout')}
                                                >
                                                    <Timer className="w-5 h-5 mr-1" />
                                                    Hết giờ
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <form
                                                    action={(formData) => startTransition(() => decisionFormAction(formData))}
                                                    className="col-span-1"
                                                >
                                                    <input type="hidden" name="sessionId" value={sessionId ?? ''} />
                                                    <input type="hidden" name="playerId" value={pl.id} />
                                                    <input type="hidden" name="decision" value="correct" />
                                                    <Button
                                                        type="submit"
                                                        size="lg"
                                                        className="w-full font-bold text-base disabled:opacity-40"
                                                        disabled={!canScore || isPending}
                                                        title={labels.correct}
                                                        aria-label={labels.correct}
                                                    >
                                                        {isPending ? (
                                                            <Loader2 className="w-5 h-5 mr-1 animate-spin" />
                                                        ) : (
                                                            <Check className="w-5 h-5 mr-1" />
                                                        )}
                                                        Đúng
                                                    </Button>
                                                </form>
                                                <form
                                                    action={(formData) => startTransition(() => decisionFormAction(formData))}
                                                    className="col-span-1"
                                                >
                                                    <input type="hidden" name="sessionId" value={sessionId ?? ''} />
                                                    <input type="hidden" name="playerId" value={pl.id} />
                                                    <input type="hidden" name="decision" value="wrong" />
                                                    <Button
                                                        type="submit"
                                                        size="lg"
                                                        variant="outline"
                                                        className="w-full font-bold text-base disabled:opacity-40"
                                                        disabled={!canScore || isPending}
                                                        title={labels.wrong}
                                                        aria-label={labels.wrong}
                                                    >
                                                        {isPending ? (
                                                            <Loader2 className="w-5 h-5 mr-1 animate-spin" />
                                                        ) : (
                                                            <X className="w-5 h-5 mr-1" />
                                                        )}
                                                        Sai
                                                    </Button>
                                                </form>
                                                <form
                                                    action={(formData) => startTransition(() => decisionFormAction(formData))}
                                                    className="col-span-1"
                                                >
                                                    <input type="hidden" name="sessionId" value={sessionId ?? ''} />
                                                    <input type="hidden" name="playerId" value={pl.id} />
                                                    <input type="hidden" name="decision" value="timeout" />
                                                    <Button
                                                        type="submit"
                                                        size="lg"
                                                        variant="outline"
                                                        className="w-full font-bold text-base disabled:opacity-40"
                                                        disabled={!canScore || isPending}
                                                        title={labels.timeout}
                                                        aria-label={labels.timeout}
                                                    >
                                                        {isPending ? (
                                                            <Loader2 className="w-5 h-5 mr-1 animate-spin" />
                                                        ) : (
                                                            <Timer className="w-5 h-5 mr-1" />
                                                        )}
                                                        Hết giờ
                                                    </Button>
                                                </form>
                                            </>
                                        )}
                                    </div>

                                    {latest?.submitted_at ? (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {new Date(latest.submitted_at).toLocaleTimeString('vi-VN')}
                                        </p>
                                    ) : null}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
