'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { lookupJoinCodeAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { toast } from 'sonner'
import { ArrowRight, Zap } from 'lucide-react'

const initialState: ActionState = { error: null, success: null }

export function QuickJoinForm() {
    const router = useRouter()
    const [code, setCode] = useState('')
    const [state, formAction] = useActionState(
        async (prev: ActionState, formData: FormData) => {
            const result = await lookupJoinCodeAction(prev, formData)
            if (result.success && result.data?.sessionId) {
                toast.success('Tìm thấy phòng thi! Chuyển hướng...')
                setTimeout(() => {
                    router.push(`/olympia/client/game/${result.data.sessionId}`)
                }, 500)
            } else if (result.error) {
                toast.error(result.error)
            }
            return result
        },
        initialState
    )

    const isPending = state.error === null && state.success === null && code.length > 0

    return (
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    <div>
                        <CardTitle>Tham gia phòng thi nhanh</CardTitle>
                        <CardDescription>Nhập mã do ban tổ chức cung cấp để bắt đầu</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form action={formAction} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="joinCode" className="text-sm font-medium">
                            Mã phòng thi
                        </label>
                        <div className="flex gap-2">
                            <Input
                                id="joinCode"
                                name="joinCode"
                                type="text"
                                placeholder="VD: ABC123"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                maxLength={10}
                                disabled={isPending}
                                className="font-mono text-lg tracking-widest"
                                autoComplete="off"
                                required
                            />
                            <Button type="submit" disabled={code.length === 0 || isPending} className="gap-2">
                                {isPending ? 'Đang tìm...' : 'Tham gia'}
                                {!isPending && <ArrowRight className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    {state.error && (
                        <Alert variant="destructive">
                            <AlertTitle>Lỗi</AlertTitle>
                            <AlertDescription>{state.error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="rounded-lg bg-white/50 dark:bg-slate-900/50 p-3 space-y-2 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">💡 Gợi ý</Badge>
                            Mã phòng là 4-10 ký tự, thường là chữ hoa và số
                        </p>
                        <p>Sau khi tham gia, bạn sẽ cần nhập mật khẩu do host cung cấp</p>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
