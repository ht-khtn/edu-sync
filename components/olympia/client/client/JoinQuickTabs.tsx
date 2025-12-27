'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    lookupJoinCodeAction,
    verifyMcPasswordAction,
    type ActionState,
} from '@/app/(olympia)/olympia/actions'
import { toast } from 'sonner'

const initialState: ActionState = { error: null, success: null }

export function JoinQuickTabs() {
    const router = useRouter()

    // Contestant (Thí sinh)
    const [contestantCode, setContestantCode] = useState('')
    const [contestantPassword, setContestantPassword] = useState('')
    const [showContestantPassword, setShowContestantPassword] = useState(false)
    const [contestantState, contestantFormAction] = useActionState(
        lookupJoinCodeAction,
        initialState
    )

    // MC
    const [mcMatchId, setMcMatchId] = useState('')
    const [mcPassword, setMcPassword] = useState('')
    const [showMcPassword, setShowMcPassword] = useState(false)
    const [mcState, mcFormAction] = useActionState(verifyMcPasswordAction, initialState)

    // Contestant success
    useEffect(() => {
        if (contestantState.success && contestantState.data?.sessionId) {
            toast.success('Đã xác nhận phòng thi. Đang vào phòng...')
            setTimeout(() => {
                router.push(`/olympia/client/game/${contestantState.data!.sessionId}`)
            }, 500)
        } else if (contestantState.error) {
            toast.error(contestantState.error)
        }
    }, [contestantState.success, contestantState.error, contestantState.data, router])

    // MC success
    useEffect(() => {
        if (mcState.success) {
            toast.success('Đã xác nhận mật khẩu MC.')
            setTimeout(() => {
                router.push(`/olympia/client/watch/${mcMatchId}`)
            }, 500)
        } else if (mcState.error) {
            toast.error(mcState.error)
        }
    }, [mcState.success, mcState.error, mcMatchId, router])

    return (
        <Tabs defaultValue="contestant" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="contestant">Thí sinh</TabsTrigger>
                <TabsTrigger value="mc">MC</TabsTrigger>
                <TabsTrigger value="guest">Khách</TabsTrigger>
            </TabsList>

            {/* Contestant Tab */}
            <TabsContent value="contestant" className="space-y-3">
                <form action={contestantFormAction} className="space-y-3">
                    <div>
                        <label htmlFor="contestantCode" className="block text-sm font-medium mb-2">
                            Mã tham gia
                        </label>
                        <Input
                            id="contestantCode"
                            name="joinCode"
                            placeholder="Ví dụ: ABC123"
                            className="font-mono text-lg tracking-widest"
                            value={contestantCode}
                            onChange={(e) => setContestantCode(e.target.value.toUpperCase().trim())}
                            required
                            maxLength={10}
                            autoComplete="off"
                        />
                    </div>

                    <div>
                        <label htmlFor="contestantPassword" className="block text-sm font-medium mb-2">
                            Mật khẩu thí sinh
                        </label>
                        <div className="relative">
                            <Input
                                id="contestantPassword"
                                name="playerPassword"
                                placeholder="••••••••"
                                type={showContestantPassword ? 'text' : 'password'}
                                className="pr-10"
                                value={contestantPassword}
                                onChange={(e) => setContestantPassword(e.target.value)}
                                required
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                onClick={() => setShowContestantPassword(!showContestantPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                aria-label={
                                    showContestantPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                                }
                            >
                                {showContestantPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={!contestantCode || !contestantPassword}>
                        Vào phòng thi
                    </Button>

                    {contestantState.error && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            {contestantState.error}
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground text-center">
                        Nhập mã phòng và mật khẩu do ban tổ chức cung cấp
                    </p>
                </form>
            </TabsContent>

            {/* MC Tab */}
            <TabsContent value="mc" className="space-y-3">
                <form action={mcFormAction} className="space-y-3">
                    <div>
                        <label htmlFor="mcMatchId" className="block text-sm font-medium mb-2">
                            Mã trận thi
                        </label>
                        <Input
                            id="mcMatchId"
                            name="matchId"
                            placeholder="Ví dụ: UUID"
                            className="font-mono text-sm"
                            value={mcMatchId}
                            onChange={(e) => setMcMatchId(e.target.value.trim())}
                            required
                            autoComplete="off"
                        />
                    </div>

                    <div>
                        <label htmlFor="mcPassword" className="block text-sm font-medium mb-2">
                            Mật khẩu MC
                        </label>
                        <div className="relative">
                            <Input
                                id="mcPassword"
                                name="mcPassword"
                                placeholder="••••••••"
                                type={showMcPassword ? 'text' : 'password'}
                                className="pr-10"
                                value={mcPassword}
                                onChange={(e) => setMcPassword(e.target.value)}
                                required
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                onClick={() => setShowMcPassword(!showMcPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                aria-label={showMcPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                                {showMcPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={!mcMatchId || !mcPassword}>
                        Mở chế độ xem MC
                    </Button>

                    {mcState.error && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            {mcState.error}
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground text-center">
                        Nhập mã trận và mật khẩu MC do admin cung cấp
                    </p>
                </form>
            </TabsContent>

            {/* Guest Tab */}
            <TabsContent value="guest" className="space-y-3">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-900 mb-3">
                        Chế độ khách cho phép bạn xem bảng xếp hạng trực tiếp mà không cần đăng nhập.
                    </p>
                    <Button asChild className="w-full">
                        <a href="/olympia/client/matches">Xem danh sách trận thi →</a>
                    </Button>
                </div>
            </TabsContent>
        </Tabs>
    )
}
