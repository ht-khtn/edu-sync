'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { confirmDecisionAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { Check, X } from 'lucide-react'
import { useActionState } from 'react'

interface Props {
    matchId: string
    sessionId: string | null
    enabledPlayerId: string | null
    roundType: string | null
    currentRoundQuestionId: string | null
}

export function HostRoundDecisionPanel({
    sessionId,
    enabledPlayerId,
    currentRoundQuestionId,
}: Props) {
    const initialState: ActionState = { error: null, success: null }
    const [state, formAction, pending] = useActionState(confirmDecisionAction, initialState)

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
                >
                    Hết giờ
                </Button>
            </form>
        </div>
    )
}
