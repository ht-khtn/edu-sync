'use client'

import { useActionState, useEffect } from 'react'
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

const initialState: DeleteQuestionSetState = { error: null, success: null }

export function DeleteQuestionSetButton({ questionSetId, questionSetName }: { questionSetId: string; questionSetName: string }) {
    const [state, formAction] = useActionState(deleteQuestionSetAction, initialState)

    useEffect(() => {
        if (state.error) toast.error(state.error)
        if (state.success) toast.success(state.success)
    }, [state.error, state.success])

    return (
        <AlertDialog>
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

                <form action={formAction}>
                    <input type="hidden" name="questionSetId" value={questionSetId} />
                    <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                            <Button type="button" variant="outline">
                                Hủy
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                            <Button type="submit" variant="destructive">
                                Xóa
                            </Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </form>
            </AlertDialogContent>
        </AlertDialog>
    )
}
