'use client'

import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { confirmDecisionAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { Check, X } from 'lucide-react'
import { useActionState } from 'react'
import { useHostBroadcast } from '@/components/olympia/admin/matches/useHostBroadcast'
import type { DecisionPingPayload } from '@/components/olympia/shared/game/useOlympiaGameState'

interface Props {
    matchId: string
    sessionId: string | null
    enabledPlayerId: string | null
    roundType: string | null
    currentRoundQuestionId: string | null
}

export function HostRoundDecisionPanel({
    matchId,
    sessionId,
    enabledPlayerId,
    currentRoundQuestionId,
}: Props) {
    const initialState: ActionState = { error: null, success: null }
    const [state, formAction, pending] = useActionState(confirmDecisionAction, initialState)
    const { sendBroadcast } = useHostBroadcast(sessionId)

    const sendDecisionPing = useCallback((decision: 'correct' | 'wrong' | 'timeout') => {
        if (!sessionId || !enabledPlayerId || !currentRoundQuestionId) return
        const payload: DecisionPingPayload = {
            matchId: matchId,
            sessionId,
            roundQuestionId: currentRoundQuestionId,
            playerId: enabledPlayerId,
            decision,
            clientTs: Date.now(),
        }
        sendBroadcast('decision_ping', payload)
    }, [currentRoundQuestionId, enabledPlayerId, matchId, sendBroadcast, sessionId])

    useEffect(() => {
        if (!sessionId || !enabledPlayerId || !currentRoundQuestionId) return
        if (state.error) toast.error(state.error)
        if (state.success) toast.success(state.success)
    }, [currentRoundQuestionId, enabledPlayerId, sessionId, state.error, state.success])

    // Chỉ show panel nếu có thí sinh được chấm
    if (!sessionId || !enabledPlayerId || !currentRoundQuestionId) {
        return null
    }

    return (
        <div className="mt-6 border-t pt-4">
            <p className="text-xs text-muted-foreground mb-3 text-center">Chấm điểm nhanh</p>
            <form action={formAction} className="flex gap-2 justify-center">
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="playerId" value={enabledPlayerId} />
                <Button
                    size="lg"
                    type="submit"
                    name="decision"
                    value="correct"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-lg h-16"
                    title="Đúng"
                    aria-label="Đúng"
                    disabled={pending}
                    onClick={() => sendDecisionPing('correct')}
                >
                    <Check className="w-6 h-6 mr-2" />
                    Đúng
                </Button>
                <Button
                    size="lg"
                    type="submit"
                    name="decision"
                    value="wrong"
                    variant="destructive"
                    className="flex-1 font-bold text-lg h-16"
                    title="Sai"
                    aria-label="Sai"
                    disabled={pending}
                    onClick={() => sendDecisionPing('wrong')}
                >
                    <X className="w-6 h-6 mr-2" />
                    Sai
                </Button>
                <Button
                    size="lg"
                    type="submit"
                    name="decision"
                    value="timeout"
                    variant="outline"
                    className="flex-1 font-bold text-lg h-16"
                    title="Hết giờ"
                    aria-label="Hết giờ"
                    disabled={pending}
                    onClick={() => sendDecisionPing('timeout')}
                >
                    Hết giờ
                </Button>
            </form>
        </div>
    )
}
