'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { deleteTournamentAction, type ActionState } from '@/app/(olympia)/olympia/actions'

const initialState: ActionState = { error: null, success: null }

type DeleteTournamentButtonProps = {
    tournamentId: string
    tournamentName?: string
}

export function DeleteTournamentButton({ tournamentId, tournamentName }: DeleteTournamentButtonProps) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement | null>(null)
    const lastToastRef = useRef<string | null>(null)

    const [state, formAction, pending] = useActionState(deleteTournamentAction, initialState)

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
        try {
            router.refresh()
        } catch {
            // ignore
        }
    }, [router, state.error, state.success])

    const handleClick = () => {
        if (pending) return

        const label = tournamentName ? `"${tournamentName}"` : 'này'
        const ok = window.confirm(
            `Bạn có chắc muốn xóa giải ${label} không?\n\nHành động này có thể tốn thời gian và sẽ thất bại nếu giải đã có trận đấu (vui lòng xóa hết trận của giải trước).`
        )
        if (!ok) return

        formRef.current?.requestSubmit()
    }

    return (
        <form ref={formRef} action={formAction}>
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Xóa giải"
                onClick={handleClick}
                disabled={pending}
                className="text-red-600"
            >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Xóa</span>
            </Button>
        </form>
    )
}
