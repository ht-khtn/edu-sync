'use client'

import { useActionState } from 'react'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ActionState } from '@/app/(olympia)/olympia/actions'

type ResetLiveSessionAndScoresAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>

const initialState: ActionState = { error: null, success: null }

type Props = {
    matchId: string
    action: ResetLiveSessionAndScoresAction
}

export function ResetLiveSessionAndScoresButton({ matchId, action }: Props) {
    const router = useRouter()
    const [state, formAction, pending] = useActionState(action, initialState)
    const lastToastRef = useRef<string | null>(null)

    useEffect(() => {
        const message = state.error ?? state.success
        if (!message) return
        if (lastToastRef.current === message) return
        lastToastRef.current = message

        if (state.error) {
            toast.error(message)
            return
        }

        toast.success(message)
        router.refresh()
    }, [router, state.error, state.success])

    return (
        <form action={formAction} className="flex justify-end">
            <input type="hidden" name="matchId" value={matchId} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
                Reset phiên live + điểm
            </Button>
        </form>
    )
}
