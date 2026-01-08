'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HostQuickScorePanel } from '@/components/olympia/admin/matches/HostQuickScorePanel'
import { subscribeHostBuzzerUpdate, subscribeHostSessionUpdate } from '@/components/olympia/admin/matches/host-events'

type HostSnapshotResponse = {
    currentRoundQuestionId: string | null
    questionState: string | null
    winnerPlayerId: string | null
}

type PlayerRow = {
    id: string
    seat_index: number | null
    display_name: string | null
}

type RoundQuestionRow = {
    id: string
    order_index: number
    target_player_id: string | null
    meta: Record<string, unknown> | null
}

type Props = {
    matchId: string
    sessionId: string
    initialRoundQuestionId: string | null
    initialQuestionState: string | null
    initialTimerDeadline: string | null

    isKhoiDong: boolean
    isVeDich: boolean

    players: PlayerRow[]
    currentRoundQuestions: RoundQuestionRow[]

    winnerBuzzPlayerId: string | null

    confirmDecisionAndAdvanceFormAction: (formData: FormData) => Promise<void>
    startSessionTimerFormAction: (formData: FormData) => Promise<void>
    confirmVeDichMainDecisionFormAction: (formData: FormData) => Promise<void>
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

function getVeDichValue(meta: Record<string, unknown> | null | undefined): number | undefined {
    if (!meta) return undefined
    const raw = meta.ve_dich_value
    if (typeof raw === 'number') return raw
    if (typeof raw === 'string' && raw.trim()) {
        const n = Number(raw)
        return Number.isFinite(n) ? n : undefined
    }
    return undefined
}

export function HostQuickScoreSection(props: Props) {
    const {
        matchId,
        sessionId,
        initialRoundQuestionId,
        initialQuestionState,
        initialTimerDeadline,
        isKhoiDong,
        isVeDich,
        players,
        currentRoundQuestions,
        winnerBuzzPlayerId,
        confirmDecisionAndAdvanceFormAction,
        startSessionTimerFormAction,
        confirmVeDichMainDecisionFormAction,
    } = props

    const [effectiveRoundQuestionId, setEffectiveRoundQuestionId] = useState<string | null>(initialRoundQuestionId)
    const [effectiveQuestionState, setEffectiveQuestionState] = useState<string | null>(initialQuestionState)
    const [effectiveTimerDeadline, setEffectiveTimerDeadline] = useState<string | null>(initialTimerDeadline)
    const [effectiveWinnerBuzzPlayerId, setEffectiveWinnerBuzzPlayerId] = useState<string | null>(
        winnerBuzzPlayerId ?? null
    )

    const effectiveRoundQuestionIdRef = useRef<string | null>(initialRoundQuestionId)
    const pollInFlightRef = useRef(false)

    useEffect(() => {
        effectiveRoundQuestionIdRef.current = effectiveRoundQuestionId
    }, [effectiveRoundQuestionId])

    useEffect(() => {
        setEffectiveRoundQuestionId(initialRoundQuestionId)
    }, [initialRoundQuestionId])

    useEffect(() => {
        setEffectiveQuestionState(initialQuestionState)
    }, [initialQuestionState])

    useEffect(() => {
        setEffectiveTimerDeadline(initialTimerDeadline)
    }, [initialTimerDeadline])

    useEffect(() => {
        setEffectiveWinnerBuzzPlayerId(winnerBuzzPlayerId ?? null)
    }, [winnerBuzzPlayerId])

    useEffect(() => {
        return subscribeHostSessionUpdate((payload) => {
            if (payload.currentRoundQuestionId !== undefined) {
                const prev = effectiveRoundQuestionIdRef.current
                const next = payload.currentRoundQuestionId
                setEffectiveRoundQuestionId(next)

                // Chỉ reset khi thực sự đổi câu.
                if (prev !== next) {
                    // Đổi câu: reset winner để tránh chấm nhầm thí sinh câu trước.
                    setEffectiveWinnerBuzzPlayerId(null)
                    // Đổi câu: timer cũng phải reset.
                    setEffectiveTimerDeadline(null)
                }
            }
            if (payload.questionState !== undefined) {
                setEffectiveQuestionState(payload.questionState)
            }
            if (payload.timerDeadline !== undefined) {
                setEffectiveTimerDeadline(payload.timerDeadline)
            }
        })
    }, [effectiveRoundQuestionIdRef])

    useEffect(() => {
        return subscribeHostBuzzerUpdate((payload) => {
            const rqId = effectiveRoundQuestionId
            if (!rqId) return
            if (payload.roundQuestionId !== rqId) return
            setEffectiveWinnerBuzzPlayerId(payload.winnerPlayerId ?? null)
        })
    }, [effectiveRoundQuestionId])

    const refreshSnapshot = useCallback(async () => {
        if (!matchId) return
        if (!sessionId) return
        if (typeof document !== 'undefined' && document.hidden) return
        if (pollInFlightRef.current) return
        pollInFlightRef.current = true

        try {
            const url = new URL('/api/olympia/host/snapshot', window.location.origin)
            url.searchParams.set('matchId', matchId)
            url.searchParams.set('sessionId', sessionId)

            const res = await fetch(url.toString(), {
                method: 'GET',
                cache: 'no-store',
                headers: { Accept: 'application/json' },
            })
            if (!res.ok) return

            const data = (await res.json()) as HostSnapshotResponse

            setEffectiveRoundQuestionId(data.currentRoundQuestionId ?? null)
            setEffectiveQuestionState(data.questionState ?? null)
            setEffectiveWinnerBuzzPlayerId(data.winnerPlayerId ?? null)
        } catch {
            // ignore: polling fallback
        } finally {
            pollInFlightRef.current = false
        }
    }, [matchId, sessionId])

    useEffect(() => {
        // Poll fallback để không phụ thuộc hoàn toàn vào Supabase Realtime.
        void refreshSnapshot()
        const t = setInterval(() => {
            void refreshSnapshot()
        }, 900)
        return () => clearInterval(t)
    }, [refreshSnapshot])

    const effectiveRoundQuestion = useMemo(() => {
        if (!effectiveRoundQuestionId) return null
        return currentRoundQuestions.find((q) => q.id === effectiveRoundQuestionId) ?? null
    }, [currentRoundQuestions, effectiveRoundQuestionId])

    const resolvePlayerIdBySeat = useCallback(
        (seat: number): string | null => {
            return (
                players.find((p) => p.seat_index === seat)?.id ??
                players.find((p) => p.seat_index === seat - 1)?.id ??
                null
            )
        },
        [players]
    )

    const hasLiveQuestion = Boolean(sessionId && effectiveRoundQuestionId)

    const isVeDichStealWindow = Boolean(isVeDich && effectiveQuestionState === 'answer_revealed')

    const enabledScoringPlayerId = useMemo(() => {
        if (!hasLiveQuestion) return null

        if (isKhoiDong) {
            const codeInfo = getKhoiDongCodeInfo(getMetaCode(effectiveRoundQuestion?.meta))
            if (codeInfo?.kind === 'common') return effectiveWinnerBuzzPlayerId ?? null

            if (codeInfo?.kind === 'personal') {
                const pid = resolvePlayerIdBySeat(codeInfo.seat)
                if (pid) return pid

                // Fallback: nếu không resolve được seat nhưng DB đã lock target_player_id.
                if (effectiveRoundQuestion?.target_player_id) return effectiveRoundQuestion.target_player_id

                return effectiveWinnerBuzzPlayerId ?? null
            }

            return effectiveWinnerBuzzPlayerId ?? null
        }

        if (isVeDich) {
            return isVeDichStealWindow
                ? (effectiveWinnerBuzzPlayerId ?? null)
                : (effectiveRoundQuestion?.target_player_id ?? null)
        }

        return null
    }, [effectiveRoundQuestion, effectiveWinnerBuzzPlayerId, hasLiveQuestion, isKhoiDong, isVeDich, isVeDichStealWindow, resolvePlayerIdBySeat])

    const scoringPlayerLabel = useMemo(() => {
        if (!enabledScoringPlayerId) return null
        const p = players.find((x) => x.id === enabledScoringPlayerId)
        if (!p) return '—'
        const seat = p.seat_index != null ? `Ghế ${p.seat_index}` : 'Thí sinh'
        return p.display_name ? `${seat} · ${p.display_name}` : seat
    }, [enabledScoringPlayerId, players])

    const durationMs = useMemo(() => {
        if (isKhoiDong) return 5000
        if (isVeDich) {
            const v = getVeDichValue(effectiveRoundQuestion?.meta)
            return v === 30 ? 20000 : 15000
        }
        return 5000
    }, [effectiveRoundQuestion?.meta, isKhoiDong, isVeDich])

    const khoiDongPersonalSeat = useMemo(() => {
        if (!isKhoiDong) return null
        const info = getKhoiDongCodeInfo(getMetaCode(effectiveRoundQuestion?.meta))
        return info && info.kind === 'personal' ? info.seat : null
    }, [effectiveRoundQuestion?.meta, isKhoiDong])

    const khoiDongPersonalPlayerId = useMemo(() => {
        return typeof khoiDongPersonalSeat === 'number' ? resolvePlayerIdBySeat(khoiDongPersonalSeat) : null
    }, [khoiDongPersonalSeat, resolvePlayerIdBySeat])

    const scoringUnlocked = useMemo(() => {
        if (!hasLiveQuestion) return false
        // Khi vừa Show câu:
        // - Khởi động thi chung (DKA-): khóa cho đến khi có winner buzzer.
        // - Khởi động thi riêng (KD{seat}-): cho phép chấm ngay.
        if (effectiveQuestionState === 'showing') {
            if (isKhoiDong) {
                const codeInfo = getKhoiDongCodeInfo(getMetaCode(effectiveRoundQuestion?.meta))
                if (codeInfo?.kind === 'personal') return true
                return Boolean(effectiveWinnerBuzzPlayerId)
            }

            if (isVeDich) {
                // Về đích: thí sinh chính không cần buzzer.
                return true
            }

            return Boolean(effectiveWinnerBuzzPlayerId)
        }
        return true
    }, [effectiveQuestionState, effectiveRoundQuestion?.meta, effectiveWinnerBuzzPlayerId, hasLiveQuestion, isKhoiDong, isVeDich])

    const disabled = !enabledScoringPlayerId || !scoringUnlocked

    const hint = useMemo(() => {
        if (!hasLiveQuestion) {
            return 'Bạn đang xem câu (preview). Hãy bấm Show để bắt đầu chấm nhanh.'
        }
        if (isKhoiDong && khoiDongPersonalSeat != null && !khoiDongPersonalPlayerId) {
            return `Khởi động thi riêng (KD${khoiDongPersonalSeat}): không tìm thấy thí sinh ghế ${khoiDongPersonalSeat}.`
        }
        if (isKhoiDong && !enabledScoringPlayerId) return 'Khởi động thi chung: cần có thí sinh bấm chuông thắng.'
        if (isVeDich && isVeDichStealWindow && !enabledScoringPlayerId) return 'Về đích: đang mở cửa cướp, chờ thí sinh bấm chuông.'
        if (isVeDich && !enabledScoringPlayerId) return 'Về đích: cần chọn thí sinh chính trước.'
        return 'Chấm nhanh.'
    }, [enabledScoringPlayerId, hasLiveQuestion, isKhoiDong, isVeDich, isVeDichStealWindow, khoiDongPersonalPlayerId, khoiDongPersonalSeat])

    const showTimeoutButton = Boolean(
        isKhoiDong &&
        khoiDongPersonalSeat != null &&
        effectiveQuestionState === 'showing' &&
        effectiveTimerDeadline
    )

    const showTimerStartButton = Boolean(
        isKhoiDong &&
        khoiDongPersonalSeat != null &&
        effectiveQuestionState === 'showing' &&
        !effectiveTimerDeadline
    )

    return (
        <HostQuickScorePanel
            hint={hint}
            scoringPlayerLabel={scoringPlayerLabel}
            isVeDich={isVeDich}
            showTimeoutButton={showTimeoutButton}
            showTimerStartButton={showTimerStartButton}
            disabled={disabled}
            timerDisabled={!hasLiveQuestion}
            roundQuestionId={effectiveRoundQuestionId}
            roundQuestionIdsInOrder={currentRoundQuestions.map((q) => q.id)}
            matchId={matchId}
            sessionId={sessionId}
            playerId={enabledScoringPlayerId ?? ''}
            durationMs={durationMs}
            confirmDecisionAndAdvanceFormAction={confirmDecisionAndAdvanceFormAction}
            startSessionTimerFormAction={startSessionTimerFormAction}
            confirmVeDichMainDecisionFormAction={confirmVeDichMainDecisionFormAction}
        />
    )
}
