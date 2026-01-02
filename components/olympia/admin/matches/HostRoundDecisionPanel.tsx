'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { confirmDecisionFormAction } from '@/app/(olympia)/olympia/actions'
import { Check, X } from 'lucide-react'

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
    roundType,
    currentRoundQuestionId,
}: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement | null>(null)

    // Chỉ show panel nếu có thí sinh được chấm
    if (!sessionId || !enabledPlayerId || !currentRoundQuestionId) {
        return null
    }

    const handleDecision = async (decision: 'correct' | 'wrong' | 'timeout') => {
        try {
            const formData = new FormData()
            formData.set('sessionId', sessionId)
            formData.set('playerId', enabledPlayerId)
            formData.set('decision', decision)

            // Gọi server action
            await confirmDecisionFormAction(formData)

            // Hiển thị toast thành công
            const labels: Record<string, string> = {
                correct: 'Đúng ✓',
                wrong: 'Sai ✗',
                timeout: 'Hết giờ',
            }
            toast.success(`${labels[decision]} - Chuyển câu...`)

            // Tự động chuyển câu sau 800ms
            setTimeout(() => {
                router.refresh()
            }, 800)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Lỗi chấm điểm')
        }
    }

    return (
        <div className="mt-6 border-t pt-4">
            <p className="text-xs text-muted-foreground mb-3 text-center">Chấm điểm nhanh</p>
            <div className="flex gap-2 justify-center">
                <Button
                    size="lg"
                    onClick={() => handleDecision('correct')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-lg h-16"
                    title="Đúng"
                    aria-label="Đúng"
                >
                    <Check className="w-6 h-6 mr-2" />
                    Đúng
                </Button>
                <Button
                    size="lg"
                    variant="destructive"
                    onClick={() => handleDecision('wrong')}
                    className="flex-1 font-bold text-lg h-16"
                    title="Sai"
                    aria-label="Sai"
                >
                    <X className="w-6 h-6 mr-2" />
                    Sai
                </Button>
                <Button
                    size="lg"
                    variant="outline"
                    onClick={() => handleDecision('timeout')}
                    className="flex-1 font-bold text-lg h-16"
                    title="Hết giờ"
                    aria-label="Hết giờ"
                >
                    Hết giờ
                </Button>
            </div>
        </div>
    )
}
