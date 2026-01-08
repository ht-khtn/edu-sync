"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HostLiveAnswersCard } from '@/components/olympia/admin/matches/HostLiveAnswersCard'
import { HostAnswersByTimeCard } from '@/components/olympia/admin/matches/HostAnswersByTimeCard'

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
    confirmDecisionVoidFormAction: (formData: FormData) => Promise<void>
    confirmVcnvRowDecisionFormAction: (formData: FormData) => Promise<void>
    confirmDecisionsBatchFormAction: (formData: FormData) => Promise<void>
}

export function HostAnswersTabs(props: Props) {
    const {
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
    } = props

    return (
        <Tabs defaultValue="cau-tra-loi" className="w-full">
            <TabsList>
                <TabsTrigger value="cau-tra-loi">Câu trả lời</TabsTrigger>
                <TabsTrigger value="dap-an">Đáp án</TabsTrigger>
            </TabsList>
            <TabsContent value="cau-tra-loi" className="mt-2">
                <HostLiveAnswersCard
                    matchId={matchId}
                    sessionId={sessionId}
                    initialRoundQuestionId={initialRoundQuestionId}
                    initialQuestionState={initialQuestionState}
                    initialWinnerBuzzPlayerId={initialWinnerBuzzPlayerId}
                    initialAnswers={initialAnswers}
                    initialRoundQuestion={initialRoundQuestion}
                    players={players}
                    isKhoiDong={isKhoiDong}
                    isVcnv={isVcnv}
                    isTangToc={isTangToc}
                    isVeDich={isVeDich}
                    confirmDecisionVoidFormAction={confirmDecisionVoidFormAction}
                    confirmVcnvRowDecisionFormAction={confirmVcnvRowDecisionFormAction}
                    confirmDecisionsBatchFormAction={confirmDecisionsBatchFormAction}
                />
            </TabsContent>
            <TabsContent value="dap-an" className="mt-2">
                <HostAnswersByTimeCard
                    matchId={matchId}
                    sessionId={sessionId}
                    players={players.map((p) => ({ id: p.id, seat_index: p.seat_index ?? null, display_name: p.display_name ?? null }))}
                    initialRoundQuestionId={initialRoundQuestionId}
                    initialAnswers={initialAnswers.map((a) => ({ ...a, response_time_ms: null }))}
                    isVcnv={isVcnv}
                    isTangToc={isTangToc}
                    confirmVcnvRowDecisionFormAction={confirmVcnvRowDecisionFormAction}
                />
            </TabsContent>
        </Tabs>
    )
}
