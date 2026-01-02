'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { setScoreboardOverlayAction, type ActionState } from '@/app/(olympia)/olympia/actions'

const initialState: ActionState = { error: null, success: null }

export function ScoreboardOverlayToggle({
    matchId,
    enabled,
}: {
    matchId: string
    enabled: boolean
}) {
    const router = useRouter()
    const [state, formAction] = useActionState(setScoreboardOverlayAction, initialState)

    useEffect(() => {
        if (state.error) toast.error(state.error)
        if (state.success) {
            toast.success(state.success)
            router.refresh()
        }
    }, [router, state.error, state.success])

    return (
        <form
            action={formAction}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-3"
        >
            <input type="hidden" name="matchId" value={matchId} />
            <input type="hidden" name="enabled" value={enabled ? '0' : '1'} />

            <div className="min-w-0">
                <p className="text-sm font-medium">Bảng điểm lớn (đồng bộ)</p>
                <p className="text-xs text-muted-foreground">Bật/tắt overlay bảng điểm cho tất cả client/guest.</p>
            </div>

            <Button
                type="submit"
                size="sm"
                variant={enabled ? 'default' : 'outline'}
                title={enabled ? 'Tắt bảng điểm lớn' : 'Bật bảng điểm lớn'}
                aria-label={enabled ? 'Tắt bảng điểm lớn' : 'Bật bảng điểm lớn'}
            >
                {enabled ? 'Đóng bảng điểm' : 'Bảng điểm'}
            </Button>
        </form>
    )
}
