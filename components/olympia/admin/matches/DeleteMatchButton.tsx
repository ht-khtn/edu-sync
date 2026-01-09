'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { deleteMatchAction, type ActionState } from '@/app/(olympia)/olympia/actions'

const initialState: ActionState = { error: null, success: null }

type DeleteMatchButtonProps = {
    matchId: string
    matchName?: string
}

export function DeleteMatchButton({ matchId, matchName }: DeleteMatchButtonProps) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement | null>(null)
    const lastToastRef = useRef<string | null>(null)

    const [state, formAction, pending] = useActionState(deleteMatchAction, initialState)

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

        const label = matchName ? `"${matchName}"` : 'này'
        const ok = window.confirm(
            `Bạn có chắc muốn xóa trận ${label} không?\n\nHành động này sẽ xóa toàn bộ dữ liệu liên quan (vòng, thí sinh, phòng thi, câu trả lời...).`
        )
        if (!ok) return

        formRef.current?.requestSubmit()
    }

    return (
        <form ref={formRef} action={formAction}>
            <input type="hidden" name="matchId" value={matchId} />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Xóa trận"
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
