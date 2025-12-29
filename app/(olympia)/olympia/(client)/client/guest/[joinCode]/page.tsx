import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { getServerAuthContext } from '@/lib/server-auth'
import { Clock, Users, Radio } from 'lucide-react'

// KEEP force-dynamic: Real-time match state
export const dynamic = 'force-dynamic'

type GuestPageProps = {
    params: {
        matchId: string
    }
}

const formatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeStyle: 'short' })

export default async function OlympiaGuestWatchPage({ params }: GuestPageProps) {
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')

    // Resolve session by join_code (routes use session.join_code). Fallback to match id if needed.
    const { data: session, error: sessionError } = await olympia
        .from('live_sessions')
        .select('id, join_code, status, question_state, current_round_type, match_id')
        .eq('join_code', params.matchId)
        .maybeSingle()

    if (sessionError) {
        console.error('Olympia guest watch page failed (session lookup)', sessionError.message)
    }

    let match = null
    let matchError = null
    if (session?.match_id) {
        const res = await olympia.from('matches').select('id, name, status, scheduled_at').eq('id', session.match_id).maybeSingle()
        match = res.data
        matchError = res.error
    } else {
        // fallback: try resolving by match id
        const res = await olympia.from('matches').select('id, name, status, scheduled_at').eq('id', params.matchId).maybeSingle()
        match = res.data
        matchError = res.error
    }

    if (matchError) {
        console.error('Olympia guest watch page failed (match lookup)', matchError.message)
    }

    if (!match) {
        notFound()
    }

    // Fetch players for resolved match id
    const playersRes = await olympia
        .from('match_players')
        .select('display_name, seat_index')
        .eq('match_id', match.id)
        .order('seat_index', { ascending: true })
    const players = playersRes.data ?? []

    const isLive = match.status === 'live' && session?.status === 'running'
    const scheduledDate = match.scheduled_at ? new Date(match.scheduled_at) : null

    return (
        <section className="space-y-6">
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <p className="text-xs uppercase text-muted-foreground">Chế độ khách</p>
                    <Badge variant="outline">Xem công khai</Badge>
                </div>
                <h1 className="text-4xl font-bold tracking-tight">{match.name}</h1>
                <p className="text-lg text-muted-foreground flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {scheduledDate ? formatter.format(scheduledDate) : 'Chưa xác định lịch'}
                </p>
            </div>

            {!isLive && (
                <Alert>
                    <AlertTitle>Trận chưa diễn ra</AlertTitle>
                    <AlertDescription>
                        Trạng thái hiện tại:{' '}
                        <span className="font-semibold">{match.status === 'scheduled' ? 'Chưa bắt đầu' : 'Đã kết thúc'}</span>. Hãy quay lại khi trận
                        bắt đầu để xem scoreboard cập nhật real-time.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Join Code Card */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-base">📱 Mã tham gia</CardTitle>
                        <CardDescription>Chia sẻ với thí sinh</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {session?.join_code ? (
                            <div className="space-y-2">
                                <p className="text-3xl font-mono font-bold text-green-600 tracking-widest text-center">{session.join_code}</p>
                                <p className="text-xs text-muted-foreground text-center">Thí sinh sẽ cần mật khẩu riêng để vào game</p>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">Chưa mở phòng live</p>
                        )}
                    </CardContent>
                </Card>

                {/* Status Card */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-base">⚡ Trạng thái trận</CardTitle>
                        <CardDescription>Thông tin real-time</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <p className="text-xs text-muted-foreground">Trạng thái phòng</p>
                            <p className="font-semibold">
                                {session?.status === 'running'
                                    ? '🟢 Đang diễn ra'
                                    : session?.status === 'pending'
                                        ? '🟡 Chờ mở'
                                        : '⚫ Đã kết thúc'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Trạng thái câu</p>
                            <p className="font-semibold">{session?.question_state ?? '—'}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Players Card */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Danh sách thí sinh
                        </CardTitle>
                        <CardDescription>{players?.length ?? 0} thí sinh</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                            {!players || players.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">Chưa có thí sinh</p>
                            ) : (
                                players.map((player, idx) => (
                                    <div key={idx} className="text-sm p-2 rounded bg-slate-50 dark:bg-slate-900">
                                        <p className="font-medium">
                                            Ghế {player.seat_index ?? '—'}: {player.display_name ?? 'Chưa có tên'}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Scoreboard Placeholder */}
            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle className="text-lg">📊 Bảng điểm trực tiếp</CardTitle>
                    <CardDescription>UI scoreboard sẽ được bổ sung trong sprint tới</CardDescription>
                </CardHeader>
                <CardContent className="min-h-48 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded">
                    <p className="text-muted-foreground">Đang phát triển...</p>
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline">
                    <Link href="/olympia/client/matches">← Quay lại danh sách</Link>
                </Button>
                {isLive && session && (
                    <Button asChild className="gap-2 bg-green-600 hover:bg-green-700">
                        <Link href={`/olympia/client/game/${session.join_code}`}>
                            <Radio className="h-4 w-4" />
                            Tham gia trò chơi (nếu là thí sinh)
                        </Link>
                    </Button>
                )}
            </div>
        </section>
    )
}
