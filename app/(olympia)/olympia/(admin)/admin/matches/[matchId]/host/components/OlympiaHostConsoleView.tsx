import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HostRoundControls } from '@/components/olympia/admin/matches/HostRoundControls'
import { HostAutoSync } from '@/components/olympia/admin/matches/HostAutoSync'
import { LiveScoreboard } from '@/components/olympia/admin/matches/LiveScoreboard'
import { InitializeRoundsButton } from '@/components/olympia/admin/matches/InitializeRoundsButton'
import { HostAutoAdvancePersonalKhoiDong } from '@/components/olympia/admin/matches/HostAutoAdvancePersonalKhoiDong'
import { HostRealtimeEventsListener } from '@/components/olympia/admin/matches/HostRealtimeEventsListener'
import { HostQuestionPreviewCard } from '@/components/olympia/admin/matches/HostQuestionPreviewCard'
import { HostQuickScoreSection } from '@/components/olympia/admin/matches/HostQuickScoreSection'
import { HostAnswersTabs } from '@/components/olympia/admin/matches/HostAnswersTabs'
import { VeDichPackageFormComponent } from '@/components/olympia/admin/matches/VeDichPackageFormComponent'
import { VeDichPackageListener } from '@/components/olympia/admin/matches/VeDichPackageListener'
import { ArrowLeft, Check, Undo2, X } from 'lucide-react'
import {
    autoScoreTangTocFormAction,
    confirmDecisionAndAdvanceFormAction,
    confirmDecisionsBatchFormAction,
    confirmDecisionVoidFormAction,
    confirmObstacleGuessFormAction,
    confirmVcnvRowDecisionFormAction,
    confirmVeDichMainDecisionFormAction,
    setCurrentQuestionFormAction,
    startSessionTimerFormAction,
    startSessionTimerAutoAction,
    expireSessionTimerAction,
    setLiveSessionRoundAction,
    setRoundQuestionTargetPlayerAction,
    setScoreboardOverlayAction,
    setAnswersOverlayAction,
    setBuzzerEnabledAction,
    endKhoiDongTurnAction,
    setWaitingScreenAction,
    setGuestMediaControlAction,
    resetMatchScoresAction,
    editMatchScoreManualAction,
    submitObstacleGuessByHostFormAction,
    toggleStarUseFormAction,
    undoLastScoreChangeFormAction,
} from '@/app/(olympia)/olympia/actions'

import { OLYMPIA_HOST_PERF_TRACE, perfTimeSync } from '../server/perf'
import {
    getKhoiDongCodeInfo,
    getMetaCode,
    getRoundQuestionLabel,
    getVeDichSeatFromOrderIndex,
    normalizePlayerSummary,
} from '../server/utils'
import type { HostData, HostObstacleTileRow, RoundQuestionRow } from '../server/types'

const statusVariants: Record<string, string> = {
    draft: 'bg-slate-200 text-slate-700',
    scheduled: 'bg-blue-100 text-blue-700',
    live: 'bg-green-100 text-green-700',
    finished: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-rose-100 text-rose-700',
}

const roundLabelMap: Record<string, string> = {
    khoi_dong: 'Khởi động',
    vcnv: 'Vượt chướng ngại vật',
    tang_toc: 'Tăng tốc',
    ve_dich: 'Về đích',
}

export function OlympiaHostConsoleView(props: {
    data: HostData
    previewParam: string | undefined
    kdSeat: number | null
    vdSeat: number | null
}) {
    const { data, previewParam, kdSeat, vdSeat } = props

    const {
        match,
        liveSession,
        rounds,
        players,
        scoreRows,
        scores,
        roundQuestions,
        currentRoundQuestion,
        isStarEnabled,
        isStarLocked,
        winnerBuzz,
        recentAnswers,
        obstacle,
        obstacleTiles,
        obstacleGuesses,
        vcnvAnswerSummary,
    } = data

    if (OLYMPIA_HOST_PERF_TRACE) console.time('[perf][host] derive+render')

    const roundTypeByRoundId = new Map<string, string | null>()
    for (const r of rounds) {
        roundTypeByRoundId.set(r.id, r.round_type)
    }
    const currentRoundId = liveSession?.current_round_id
    const currentRoundQuestions = currentRoundId
        ? roundQuestions.filter((q) => q.match_round_id === currentRoundId)
        : roundQuestions
    const statusClass = statusVariants[match.status] ?? 'bg-slate-100 text-slate-700'

    const questionsByRoundType = new Map<string, string[]>()
    const selectedQuestionsByRoundType = new Map<string, string[]>()
    const unselectedQuestionsByRoundType = new Map<string, string[]>()
    for (const q of roundQuestions) {
        const roundType = roundTypeByRoundId.get((q as unknown as RoundQuestionRow).match_round_id) ?? null
        const key = roundType ?? 'unknown'
        const label = getRoundQuestionLabel(q as unknown as RoundQuestionRow)
        const rqRow = q as unknown as RoundQuestionRow
        const hasSelection = Boolean(rqRow.question_set_item_id)

        const list = questionsByRoundType.get(key) ?? []
        list.push(label)
        questionsByRoundType.set(key, list)

        if (hasSelection) {
            const selectedList = selectedQuestionsByRoundType.get(key) ?? []
            selectedList.push(label)
            selectedQuestionsByRoundType.set(key, selectedList)
        } else {
            const unselectedList = unselectedQuestionsByRoundType.get(key) ?? []
            unselectedList.push(label)
            unselectedQuestionsByRoundType.set(key, unselectedList)
        }
    }
    const questionsByRoundTypeEntries = Array.from(questionsByRoundType.entries())
        .map(([roundType, codes]) => ({ roundType, codes }))
        .sort((a, b) => a.roundType.localeCompare(b.roundType))
    const selectedQuestionsByRoundTypeEntries = Array.from(selectedQuestionsByRoundType.entries())
        .map(([roundType, codes]) => ({ roundType, codes }))
        .sort((a, b) => a.roundType.localeCompare(b.roundType))
    const unselectedQuestionsByRoundTypeEntries = Array.from(unselectedQuestionsByRoundType.entries())
        .map(([roundType, codes]) => ({ roundType, codes }))
        .sort((a, b) => a.roundType.localeCompare(b.roundType))

    // Debug: Câu đã chọn theo thí sinh ở vòng Về đích
    const selectedQuestionsByPlayerInVeDich = perfTimeSync('[perf][host] derive selectedQuestionsByPlayerInVeDich', () => {
        if (!liveSession?.current_round_id) {
            return new Map<string, { full_name: string | null; selectedCodes: string[] }>()
        }
        const veDichRound = rounds.find((r) => r.round_type === 've_dich')
        if (!veDichRound?.id) {
            return new Map<string, { full_name: string | null; selectedCodes: string[] }>()
        }

        const rqInVeDich = roundQuestions.filter((q) => q.match_round_id === veDichRound.id)
        const bySeat = new Map<number, Array<RoundQuestionRow>>()
        for (const q of rqInVeDich) {
            const oi = (q as unknown as RoundQuestionRow).order_index
            const seat = getVeDichSeatFromOrderIndex(oi)
            if (!seat) continue
            const list = bySeat.get(seat) ?? []
            list.push(q as unknown as RoundQuestionRow)
            bySeat.set(seat, list)
        }

        const out = new Map<string, { full_name: string | null; selectedCodes: string[] }>()
        for (const p of players) {
            if (typeof p.seat_index !== 'number') {
                out.set(p.id, { full_name: p.display_name ?? null, selectedCodes: [] })
                continue
            }
            const list = (bySeat.get(p.seat_index) ?? [])
                .slice()
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
            const selectedCodes = list
                .slice(0, 3)
                .filter((rq) => Boolean(rq.question_set_item_id))
                .map((rq) => getRoundQuestionLabel(rq))
            out.set(p.id, { full_name: p.display_name ?? null, selectedCodes })
        }
        return out
    })

    const selectedTargetPlayerId = currentRoundQuestion?.target_player_id ?? null

    const isKhoiDong = liveSession?.current_round_type === 'khoi_dong'
    const isVcnv = liveSession?.current_round_type === 'vcnv'
    const isTangToc = liveSession?.current_round_type === 'tang_toc'
    const isVeDich = liveSession?.current_round_type === 've_dich'
    const allowTargetSelection = Boolean(isKhoiDong || isVeDich)

    // Khởi động: xác định thi riêng/thi chung theo mã câu (KD{seat}- / DKA-), không phụ thuộc target_player_id.
    const khoiDongCodeInfoLive = isKhoiDong
        ? getKhoiDongCodeInfo(getMetaCode((currentRoundQuestion as unknown as RoundQuestionRow | null)?.meta ?? null))
        : null

    const khoiDongPersonalSeat =
        khoiDongCodeInfoLive && khoiDongCodeInfoLive.kind === 'personal' ? khoiDongCodeInfoLive.seat : null

    const currentRoundQuestionsForQuickScoreSection = currentRoundQuestions.map((q) => {
        const row = q as RoundQuestionRow
        const meta = row.meta && typeof row.meta === 'object' ? row.meta : null
        return {
            id: row.id,
            order_index: row.order_index,
            target_player_id: row.target_player_id ?? null,
            meta,
        }
    })

    const filteredCurrentRoundQuestions = (() => {
        if (isVeDich) {
            if (typeof vdSeat !== 'number') return []
            return currentRoundQuestions
                .filter((q) => {
                    const oi = (q as unknown as RoundQuestionRow).order_index
                    const seat = getVeDichSeatFromOrderIndex(oi)
                    return seat === vdSeat
                })
                .slice()
                .sort(
                    (a, b) =>
                        ((a as unknown as RoundQuestionRow).order_index ?? 0) -
                        ((b as unknown as RoundQuestionRow).order_index ?? 0)
                )
                .slice(0, 3)
        }

        // Khởi động: lọc theo luật mã câu (KD{seat}- / DKA-)
        if (!isKhoiDong) return currentRoundQuestions

        // Lọc theo luật mã câu:
        // - Thi chung: DKA-
        // - Thi riêng: KD{seat}-
        if (typeof kdSeat === 'number') {
            const prefix = `KD${kdSeat}-`
            return currentRoundQuestions.filter((q) => {
                const code = getMetaCode((q as unknown as RoundQuestionRow).meta)
                return typeof code === 'string' && code.toUpperCase().startsWith(prefix)
            })
        }

        // Mặc định thi chung (DKA-) khi chưa chọn thí sinh.
        return currentRoundQuestions.filter((q) => {
            const code = getMetaCode((q as unknown as RoundQuestionRow).meta)
            return getKhoiDongCodeInfo(code)?.kind === 'common'
        })
    })()

    const previewRoundQuestionId =
        previewParam && filteredCurrentRoundQuestions.some((q) => q.id === previewParam)
            ? previewParam
            : liveSession?.current_round_question_id &&
                filteredCurrentRoundQuestions.some((q) => q.id === liveSession.current_round_question_id)
                ? liveSession.current_round_question_id
                : null

    const veDichPackageByPlayerId = perfTimeSync('[perf][host] derive veDichPackageByPlayerId', () => {
        if (!liveSession?.current_round_id) {
            return new Map<string, { values: Array<20 | 30 | null>; confirmed: boolean }>()
        }
        const rqInVeDich = roundQuestions.filter((q) => q.match_round_id === liveSession.current_round_id)
        const bySeat = new Map<number, Array<RoundQuestionRow>>()
        for (const q of rqInVeDich) {
            const oi = (q as unknown as RoundQuestionRow).order_index
            const seat = getVeDichSeatFromOrderIndex(oi)
            if (!seat) continue
            const list = bySeat.get(seat) ?? []
            list.push(q as unknown as RoundQuestionRow)
            bySeat.set(seat, list)
        }

        const out = new Map<string, { values: Array<20 | 30 | null>; confirmed: boolean }>()
        for (const p of players) {
            if (typeof p.seat_index !== 'number') {
                out.set(p.id, { values: [null, null, null], confirmed: false })
                continue
            }
            const list = (bySeat.get(p.seat_index) ?? [])
                .slice()
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
            const slotValues = list.slice(0, 3).map((rq) => {
                const raw =
                    rq.meta && typeof rq.meta === 'object'
                        ? (rq.meta as Record<string, unknown>).ve_dich_value
                        : undefined
                const v = typeof raw === 'number' ? raw : raw ? Number(raw) : Number.NaN
                return v === 20 || v === 30 ? v : null
            })
            while (slotValues.length < 3) slotValues.push(null)

            const confirmed = list.slice(0, 3).length === 3 && list.slice(0, 3).every((rq) => Boolean(rq.question_set_item_id))
            out.set(p.id, { values: slotValues.slice(0, 3) as Array<20 | 30 | null>, confirmed })
        }
        return out
    })

    const jsx = (
        <section className="space-y-4">
            <VeDichPackageListener />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Host console</p>
                    <h1 className="truncate text-xl font-semibold">{match.name}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="icon-sm" title="Về chi tiết trận" aria-label="Về chi tiết trận">
                        <Link href={`/olympia/admin/matches/${match.id}`}>
                            <ArrowLeft />
                        </Link>
                    </Button>
                    <Badge className={statusClass}>{match.status}</Badge>
                </div>
            </div>

            {rounds.length === 0 ? (
                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="pt-6 space-y-3">
                        <p className="text-sm text-amber-900">
                            <strong>Chưa có vòng thi!</strong> Cần tạo vòng trước khi mở phòng / gán câu.
                        </p>
                        <InitializeRoundsButton matchId={match.id} roundsCount={rounds.length} />
                    </CardContent>
                </Card>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    <HostQuestionPreviewCard
                        matchId={match.id}
                        liveSession={
                            liveSession
                                ? {
                                    id: liveSession.id ?? null,
                                    status: liveSession.status ?? null,
                                    question_state: liveSession.question_state ?? null,
                                    current_round_type: liveSession.current_round_type ?? null,
                                    current_round_id: liveSession.current_round_id ?? null,
                                    current_round_question_id: liveSession.current_round_question_id ?? null,
                                }
                                : null
                        }
                        descriptionText={(() => {
                            if (!liveSession?.current_round_type) return 'Chưa chọn vòng'
                            const roundText = roundLabelMap[liveSession.current_round_type] ?? liveSession.current_round_type
                            if (!allowTargetSelection) return roundText
                            if (isKhoiDong) {
                                return typeof kdSeat === 'number'
                                    ? `${roundText} · Thi riêng · Ghế ${kdSeat}`
                                    : `${roundText} · Thi chung`
                            }
                            if (selectedTargetPlayerId) {
                                const p = players.find((x) => x.id === selectedTargetPlayerId)
                                const label = p?.display_name ?? (p?.seat_index != null ? `Ghế ${p.seat_index}` : 'Thí sinh')
                                return `${roundText} · Thí sinh: ${label}`
                            }
                            return roundText
                        })()}
                        options={filteredCurrentRoundQuestions.map((q) => ({
                            id: q.id,
                            label: `#${q.order_index ?? '?'} · ${getRoundQuestionLabel(q as unknown as RoundQuestionRow)}`,
                        }))}
                        questions={
                            filteredCurrentRoundQuestions as unknown as import('@/components/olympia/admin/matches/HostQuestionPreviewCard').HostPreviewRoundQuestion[]
                        }
                        initialPreviewId={previewRoundQuestionId}
                        triggerReset={liveSession?.current_round_question_id === null}
                        questionsDebug={{
                            totalRoundQuestions: roundQuestions.length,
                            currentRoundQuestionsCount: currentRoundQuestions.length,
                            currentRoundType: liveSession?.current_round_type ?? null,
                            currentRoundId: liveSession?.current_round_id ?? null,
                            byRoundType: questionsByRoundTypeEntries,
                            selectedByRoundType: selectedQuestionsByRoundTypeEntries,
                            unselectedByRoundType: unselectedQuestionsByRoundTypeEntries,
                            selectedByPlayerInVeDich: Array.from(selectedQuestionsByPlayerInVeDich.entries()).map(
                                ([playerId, data]) => ({
                                    playerId,
                                    fullName: data.full_name,
                                    selectedCodes: data.selectedCodes,
                                })
                            ),
                        }}
                        winnerBuzz={winnerBuzz}
                        setCurrentQuestionFormAction={setCurrentQuestionFormAction}
                        setGuestMediaControlAction={setGuestMediaControlAction}
                        toggleStarUseFormAction={toggleStarUseFormAction}
                        isStarEnabled={isStarEnabled}
                        isStarLocked={isStarLocked}
                        currentTargetPlayerId={currentRoundQuestion?.target_player_id ?? null}
                    />

                    {isVcnv && obstacle ? (
                        (() => {
                            const byPos = new Map<number, HostObstacleTileRow>()
                            for (const t of obstacleTiles) {
                                if (typeof t.position_index === 'number') byPos.set(t.position_index, t)
                            }

                            const getRq = (rqId: string | null) => {
                                if (!rqId) return null
                                return (
                                    roundQuestions.find((q) => (q as unknown as RoundQuestionRow).id === rqId) as unknown as
                                    | RoundQuestionRow
                                    | undefined
                                ) ?? null
                            }

                            const normalizeWord = (text: string | null | undefined) => {
                                const raw = (text ?? '').trim()
                                if (!raw) return ''
                                return raw
                            }

                            const buildBoxes = (answerText: string, reveal: boolean) => {
                                const chars = Array.from(answerText)
                                return (
                                    <div className="flex flex-wrap gap-1">
                                        {chars.map((ch, idx) => {
                                            if (ch === ' ') {
                                                return <span key={idx} className="w-2" />
                                            }
                                            const show = reveal ? ch.toUpperCase() : ''
                                            return (
                                                <span
                                                    key={idx}
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded border bg-white text-sm font-semibold"
                                                    aria-label={reveal ? show : 'Ô chữ'}
                                                >
                                                    {show}
                                                </span>
                                            )
                                        })}
                                    </div>
                                )
                            }

                            const computeRowStatus = (rqId: string | null) => {
                                if (!rqId) return { attempted: false, anyCorrect: false, locked: false }
                                const rows = vcnvAnswerSummary.filter((a) => a.round_question_id === rqId)
                                // Chỉ coi là "đã có kết quả" khi host đã chấm (is_correct != null).
                                const attempted = rows.some((r) => r.is_correct != null)
                                const anyCorrect = rows.some((r) => r.is_correct === true)
                                // Khoá = có kết quả nhưng không ai đúng (không dùng tile.is_open, chỉ dùng answers)
                                const locked = attempted && !anyCorrect
                                return { attempted, anyCorrect, locked }
                            }

                            const tilesForImage: Array<{ pos: number; label: string; className: string }> = [
                                { pos: 1, label: '1', className: 'left-2 top-2' },
                                { pos: 2, label: '2', className: 'right-2 top-2' },
                                { pos: 3, label: '3', className: 'left-2 bottom-2' },
                                { pos: 4, label: '4', className: 'right-2 bottom-2' },
                                { pos: 5, label: 'TT', className: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' },
                            ]

                            const renderRow = (pos: number, title: string) => {
                                const tile = byPos.get(pos) ?? null
                                const rq = getRq(tile?.round_question_id ?? null)
                                const answer = normalizeWord(rq?.answer_text)
                                const { anyCorrect, locked } = computeRowStatus(tile?.round_question_id ?? null)
                                const reveal = anyCorrect

                                return (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs text-muted-foreground">{title}</p>
                                            <p className="text-xs text-muted-foreground">{reveal ? 'Mở' : locked ? 'Đóng' : 'Chưa mở'}</p>
                                        </div>
                                        {answer ? buildBoxes(answer, reveal) : <p className="text-xs text-muted-foreground">(Chưa có đáp án)</p>}
                                    </div>
                                )
                            }

                            return (
                                <div className="rounded-md border bg-background p-3">
                                    <p className="text-xs text-muted-foreground mb-3">
                                        VCNV: 4 hàng ngang + 1 ô trung tâm. Ô chữ sẽ hiện khi hàng được mở.
                                    </p>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <div className="relative overflow-hidden rounded-md border bg-slate-50">
                                                {obstacle.image_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={obstacle.image_url}
                                                        alt={obstacle.title ?? 'Chướng ngại vật'}
                                                        className="h-64 w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-64 w-full items-center justify-center text-sm text-muted-foreground">
                                                        (Chưa có ảnh CNV)
                                                    </div>
                                                )}

                                                {tilesForImage.map((t) => {
                                                    const tile = byPos.get(t.pos) ?? null
                                                    const { anyCorrect, locked } = computeRowStatus(tile?.round_question_id ?? null)
                                                    const hidden = anyCorrect
                                                    if (hidden) return null
                                                    return (
                                                        <div
                                                            key={t.pos}
                                                            className={`absolute ${t.className} flex h-16 w-16 items-center justify-center rounded-md border ${locked ? 'bg-slate-200' : 'bg-slate-100'
                                                                }`}
                                                            aria-label={locked ? `Ô ${t.label} (đóng)` : `Ô ${t.label} (che)`}
                                                        >
                                                            <span className="text-sm font-semibold text-slate-700">{t.label}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {renderRow(1, 'Hàng 1')}
                                            {renderRow(2, 'Hàng 2')}
                                            {renderRow(3, 'Hàng 3')}
                                            {renderRow(4, 'Hàng 4')}
                                            {renderRow(5, 'Trung tâm')}
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-3">
                                        <div className="rounded-md border bg-slate-50 p-3">
                                            <p className="text-xs font-semibold text-slate-700">Chuông đoán CNV (miệng)</p>
                                            <form action={submitObstacleGuessByHostFormAction} className="mt-2 flex flex-wrap gap-2">
                                                <input type="hidden" name="sessionId" value={liveSession?.id ?? ''} />
                                                <select
                                                    name="playerId"
                                                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                                    aria-label="Chọn thí sinh đoán CNV"
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>
                                                        Chọn thí sinh…
                                                    </option>
                                                    {players.map((p) => (
                                                        <option key={p.id} value={p.id}>
                                                            Ghế {p.seat_index}
                                                            {p.display_name ? ` · ${p.display_name}` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    name="guessText"
                                                    className="flex-1 min-w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                                    placeholder="Nhập từ khóa CNV…"
                                                    aria-label="Từ khóa CNV"
                                                />
                                                <Button type="submit" size="sm" className="h-9">
                                                    Ghi nhận
                                                </Button>
                                            </form>
                                        </div>

                                        {obstacleGuesses.length > 0 ? (
                                            <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground">Lượt đoán CNV gần đây</p>
                                                <div className="grid gap-2">
                                                    {obstacleGuesses.map((g) => {
                                                        const seat = normalizePlayerSummary(g.match_players)?.seat_index
                                                        const statusText = g.is_correct ? 'Đúng' : 'Chưa xác nhận/Sai'
                                                        return (
                                                            <div key={g.id} className="rounded-md border bg-background p-3">
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                    <p className="text-sm font-medium">Ghế {seat ?? '—'}</p>
                                                                    <Badge variant={g.is_correct ? 'default' : 'outline'}>{statusText}</Badge>
                                                                </div>
                                                                <p className="mt-2 text-sm font-semibold">{g.guess_text}</p>
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    <form action={confirmObstacleGuessFormAction}>
                                                                        <input type="hidden" name="answerId" value={g.id} />
                                                                        <input type="hidden" name="decision" value="correct" />
                                                                        <Button
                                                                            type="submit"
                                                                            size="sm"
                                                                            disabled={g.is_correct}
                                                                            title="Xác nhận đúng"
                                                                            aria-label="Xác nhận đúng"
                                                                        >
                                                                            <Check className="h-4 w-4 mr-1" />
                                                                            Đúng
                                                                        </Button>
                                                                    </form>
                                                                    <form action={confirmObstacleGuessFormAction}>
                                                                        <input type="hidden" name="answerId" value={g.id} />
                                                                        <input type="hidden" name="decision" value="wrong" />
                                                                        <Button
                                                                            type="submit"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            disabled={g.is_correct}
                                                                            title="Xác nhận sai (loại quyền CNV)"
                                                                            aria-label="Xác nhận sai (loại quyền CNV)"
                                                                        >
                                                                            <X className="h-4 w-4 mr-1" />
                                                                            Sai
                                                                        </Button>
                                                                    </form>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })()
                    ) : null}

                    {isKhoiDong || isVeDich ? (
                        <div>
                            {isKhoiDong &&
                                khoiDongPersonalSeat != null &&
                                liveSession?.question_state === 'showing' &&
                                liveSession?.timer_deadline ? (
                                <div className="mb-2">
                                    <HostAutoAdvancePersonalKhoiDong deadlineIso={liveSession.timer_deadline} />
                                </div>
                            ) : null}

                            <HostQuickScoreSection
                                matchId={match.id}
                                sessionId={liveSession?.id ?? ''}
                                initialRoundQuestionId={liveSession?.current_round_question_id ?? null}
                                initialQuestionState={liveSession?.question_state ?? null}
                                initialTimerDeadline={liveSession?.timer_deadline ?? null}
                                isKhoiDong={isKhoiDong}
                                isVeDich={isVeDich}
                                players={players}
                                currentRoundQuestions={currentRoundQuestionsForQuickScoreSection}
                                winnerBuzzPlayerId={winnerBuzz?.player_id ?? null}
                                confirmDecisionAndAdvanceFormAction={confirmDecisionAndAdvanceFormAction}
                                startSessionTimerFormAction={startSessionTimerFormAction}
                                confirmVeDichMainDecisionFormAction={confirmVeDichMainDecisionFormAction}
                            />
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <HostAnswersTabs
                            matchId={match.id}
                            sessionId={liveSession?.id ?? null}
                            initialRoundQuestionId={liveSession?.current_round_question_id ?? null}
                            initialQuestionState={liveSession?.question_state ?? null}
                            initialWinnerBuzzPlayerId={winnerBuzz?.player_id ?? null}
                            initialAnswers={recentAnswers.map((a) => ({
                                id: a.id,
                                player_id: a.player_id,
                                answer_text: a.answer_text,
                                is_correct: a.is_correct,
                                points_awarded: a.points_awarded,
                                submitted_at: a.submitted_at,
                            }))}
                            initialRoundQuestion={
                                currentRoundQuestion
                                    ? {
                                        id: currentRoundQuestion.id,
                                        target_player_id: currentRoundQuestion.target_player_id ?? null,
                                        meta: currentRoundQuestion.meta ?? null,
                                    }
                                    : null
                            }
                            players={players.map((p) => ({
                                id: p.id,
                                seat_index: p.seat_index ?? null,
                                display_name: p.display_name ?? null,
                                is_disqualified_obstacle: p.is_disqualified_obstacle ?? null,
                            }))}
                            isKhoiDong={isKhoiDong}
                            isVcnv={isVcnv}
                            isTangToc={isTangToc}
                            isVeDich={isVeDich}
                            confirmDecisionVoidFormAction={confirmDecisionVoidFormAction}
                            confirmDecisionsBatchFormAction={confirmDecisionsBatchFormAction}
                            confirmVcnvRowDecisionFormAction={confirmVcnvRowDecisionFormAction}
                        />

                        <div className="flex items-center justify-end gap-2">
                            <form action={undoLastScoreChangeFormAction} className="flex items-center justify-end gap-2">
                                <input type="hidden" name="matchId" value={match.id} />
                                <input type="hidden" name="reason" value="" />
                                <Button type="submit" size="icon-sm" variant="outline" title="Undo" aria-label="Undo">
                                    <Undo2 />
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Điều khiển</CardTitle>
                            <CardDescription>Chọn vòng, chọn thí sinh (tuỳ vòng), chọn câu và thao tác nhanh.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <HostAutoSync
                                sessionId={liveSession?.id ?? null}
                                currentRoundType={liveSession?.current_round_type ?? null}
                                currentRoundQuestionId={liveSession?.current_round_question_id ?? null}
                                questionState={liveSession?.question_state ?? null}
                            />

                            <HostRealtimeEventsListener
                                matchId={match.id}
                                sessionId={liveSession?.id ?? null}
                                currentRoundQuestionId={liveSession?.current_round_question_id ?? null}
                                playerLabelsById={Object.fromEntries(
                                    players.map((p) => {
                                        const seat = p.seat_index != null ? String(p.seat_index) : '—'
                                        const name = p.display_name ? ` · ${p.display_name}` : ''
                                        return [p.id, `Ghế ${seat}${name}`]
                                    })
                                )}
                            />

                            <HostRoundControls
                                matchId={match.id}
                                sessionId={liveSession?.id ?? null}
                                rounds={rounds}
                                players={players}
                                setLiveSessionRoundAction={setLiveSessionRoundAction}
                                setWaitingScreenAction={setWaitingScreenAction}
                                setScoreboardOverlayAction={setScoreboardOverlayAction}
                                setAnswersOverlayAction={setAnswersOverlayAction}
                                setBuzzerEnabledAction={setBuzzerEnabledAction}
                                setRoundQuestionTargetPlayerAction={setRoundQuestionTargetPlayerAction}
                                endKhoiDongTurnAction={endKhoiDongTurnAction}
                                startSessionTimerAutoAction={startSessionTimerAutoAction}
                                expireSessionTimerAction={expireSessionTimerAction}
                                setGuestMediaControlAction={setGuestMediaControlAction}
                                allowTargetSelection={allowTargetSelection}
                                currentRoundQuestionId={liveSession?.current_round_question_id ?? null}
                                currentTargetPlayerId={currentRoundQuestion?.target_player_id ?? null}
                                isKhoiDong={isKhoiDong}
                                currentRoundType={liveSession?.current_round_type}
                                currentQuestionState={liveSession?.question_state}
                                timerDeadline={liveSession?.timer_deadline ?? null}
                                buzzerEnabled={liveSession?.buzzer_enabled ?? null}
                                showScoreboardOverlay={liveSession?.show_scoreboard_overlay ?? null}
                                showAnswersOverlay={liveSession?.show_answers_overlay ?? null}
                                currentQuestionMeta={currentRoundQuestion?.meta ?? null}
                            />

                            {allowTargetSelection ? (
                                <div className="grid gap-2">
                                    {isVeDich ? (
                                        <div className="grid gap-2">
                                            <div className="rounded-md border bg-slate-50 p-3">
                                                <p className="text-xs font-semibold text-slate-700">Về đích: Chọn thí sinh → Chọn gói (3 câu)</p>
                                                <p className="mt-1 text-xs text-muted-foreground">Tất cả thao tác trên Host. Mỗi câu chọn 20 hoặc 30.</p>

                                                {typeof vdSeat !== 'number' ? (
                                                    <p className="mt-3 text-xs text-muted-foreground">Hãy chọn thí sinh trước (dropdown ở trên).</p>
                                                ) : (
                                                    (() => {
                                                        const selectedPlayer = players.find((x) => x.seat_index === vdSeat) ?? null
                                                        if (!selectedPlayer) {
                                                            return (
                                                                <p className="mt-3 text-xs text-muted-foreground">Không tìm thấy thí sinh của Ghế {vdSeat}.</p>
                                                            )
                                                        }
                                                        const pkg = veDichPackageByPlayerId.get(selectedPlayer.id) ?? null
                                                        const confirmed = Boolean(pkg?.confirmed)
                                                        const values = pkg?.values ?? [null, null, null]
                                                        return (
                                                            <VeDichPackageFormComponent
                                                                matchId={match.id}
                                                                selectedPlayer={selectedPlayer}
                                                                values={values}
                                                                confirmed={confirmed}
                                                            />
                                                        )
                                                    })()
                                                )}
                                            </div>


                                        </div>
                                    ) : null}

                                    {liveSession?.current_round_type === 'tang_toc' ? (
                                        <form action={autoScoreTangTocFormAction} className="flex justify-end">
                                            <input type="hidden" name="sessionId" value={liveSession?.id ?? ''} />
                                            <Button
                                                type="submit"
                                                size="icon-sm"
                                                variant="outline"
                                                disabled={!liveSession?.id || !liveSession?.current_round_question_id || !currentRoundQuestion}
                                                title="Chấm tự động Tăng tốc"
                                                aria-label="Chấm tự động Tăng tốc"
                                            >
                                                <Check />
                                            </Button>
                                        </form>
                                    ) : null}
                                </div>
                            ) : null}

                            {/* Chấm điểm đã chuyển qua card "Câu trả lời" để giảm rối UI */}

                            {liveSession?.status !== 'running' ? (
                                <p className="text-xs text-muted-foreground">Cần mở phòng (running) để đổi vòng/trạng thái câu.</p>
                            ) : liveSession?.join_code ? (
                                <p className="text-xs text-muted-foreground">
                                    Mã phòng: <span className="font-mono">{liveSession.join_code}</span>
                                </p>
                            ) : null}
                        </CardContent>
                    </Card>

                    {scores.length > 0 ? (
                        <LiveScoreboard
                            matchId={match.id}
                            initialScoreRows={scoreRows}
                            scores={scores}
                            title="Xếp hạng"
                            description=""
                            resetScoresAction={resetMatchScoresAction}
                            editScoreAction={editMatchScoreManualAction}
                        />
                    ) : null}
                </div>
            </div>
        </section>
    )

    if (OLYMPIA_HOST_PERF_TRACE) console.timeEnd('[perf][host] derive+render')
    return jsx
}
