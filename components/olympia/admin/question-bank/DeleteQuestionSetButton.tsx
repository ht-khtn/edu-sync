'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { deleteQuestionSetAction, type DeleteQuestionSetState } from '@/app/(olympia)/olympia/(admin)/admin/question-bank/actions'
import { useRouter } from 'next/navigation'

const initialState: DeleteQuestionSetState = { error: null, success: null }

export function DeleteQuestionSetButton({ questionSetId, questionSetName }: { questionSetId: string; questionSetName: string }) {
    const [open, setOpen] = useState(false)
    const [nonce, setNonce] = useState(0)
    const router = useRouter()
    const [state, formAction, pending] = useActionState(deleteQuestionSetAction, initialState)
    const lastToastRef = useRef<string | null>(null)

    useEffect(() => {
        const message = state.error ?? state.success
        if (!message) return
        if (lastToastRef.current === message) return
        lastToastRef.current = message

        if (state.error) toast.error(message)
        if (state.success) {
            toast.success(message)
            setOpen(false)
            router.refresh()
        }
    }, [router, state.error, state.success])

    const handleOpenChange = (value: boolean) => {
        setOpen(value)
        if (!value) {
            setNonce((v) => v + 1)
            lastToastRef.current = null
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
                    Xóa
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Xóa bộ đề?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Hành động này sẽ xóa bộ đề “{questionSetName}” và toàn bộ câu hỏi thuộc bộ đề. Nếu bộ đề đã được sử dụng trong trận,
                        hệ thống sẽ chặn xóa.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <form key={nonce} action={formAction}>
                    <input type="hidden" name="questionSetId" value={questionSetId} />
                    <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                            <Button type="button" variant="outline">
                                Hủy
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                            <Button type="submit" variant="destructive" disabled={pending}>
                                {pending ? 'Đang xóa…' : 'Xóa'}
                            </Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </form>
            </AlertDialogContent>
        </AlertDialog>
    )
}
