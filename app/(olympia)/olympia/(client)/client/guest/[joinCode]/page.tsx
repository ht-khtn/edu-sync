import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OlympiaGameClient } from '@/components/olympia/shared/game'
import { getServerAuthContext } from '@/lib/server-auth'
import { Clock, Users, Radio } from 'lucide-react'
import type { GameSessionPayload } from '@/types/olympia/game'

// KEEP force-dynamic: Real-time match state
export const dynamic = 'force-dynamic'

type GuestPageProps = {
    params: {
        matchId: string
    }
}

const formatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeStyle: 'short' })

async function getGuestSessionData(
    supabase: SupabaseClient,
    joinCodeOrMatchId: string
): Promise<{ payload: GameSessionPayload | null; joinCode: string | null; matchName: string | null }> {
    const olympia = supabase.schema('olympia')

    const { data: session } = await olympia
        .from('live_sessions')
        .select(
            'id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline, requires_player_password'
        )
        .eq('join_code', joinCodeOrMatchId)
        .maybeSingle()

    let matchId = session?.match_id ?? null
    if (!matchId) {
        // fallback: treat param as matchId
        matchId = joinCodeOrMatchId
    }

    const { data: match } = await olympia
        .from('matches')
        .select('id, name, status, scheduled_at')
        .eq('id', matchId)
        .maybeSingle()

    if (!match) {
        return { payload: null, joinCode: session?.join_code ?? null, matchName: null }
    }

    // Ensure we have a live session if possible
    const resolvedSession =
        session ??
        (await olympia
            .from('live_sessions')
            .select(
                'id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline, requires_player_password'
            )
            .eq('match_id', match.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()).data

    if (!resolvedSession) {
        return { payload: null, joinCode: null, matchName: match.name }
    }

    const [{ data: players }, { data: scores }, { data: roundQuestions }, { data: buzzerEvents }] = await Promise.all([
        olympia
            .from('match_players')
            .select('id, match_id, participant_id, seat_index, display_name, is_disqualified_obstacle')
            .eq('match_id', match.id)
            .order('seat_index', { ascending: true }),
        olympia
            .from('match_scores')
            .select('id, match_id, player_id, round_type, points')
            .eq('match_id', match.id),
        olympia
            .from('round_questions')
            .select('id, match_round_id, question_id, order_index, target_player_id, meta, match_rounds!inner(match_id, round_type)')
            .eq('match_rounds.match_id', match.id)
            .order('order_index', { ascending: true }),
        resolvedSession.current_round_question_id
            ? olympia
                .from('buzzer_events')
                .select('id, match_id, round_question_id, player_id, event_type, result, occurred_at')
                .eq('round_question_id', resolvedSession.current_round_question_id)
                .order('occurred_at', { ascending: false })
                .limit(20)
            : Promise.resolve({ data: [] }),
    ])

    const obstacleBundle = resolvedSession.current_round_id
        ? await (async () => {
            const { data: obstacle } = await olympia
                .from('obstacles')
                .select('id, match_round_id, title, final_keyword, image_url, meta')
                .eq('match_round_id', resolvedSession.current_round_id)
                .maybeSingle()

            if (!obstacle) return { obstacle: null, tiles: [], guesses: [] }

            const [{ data: tiles }, { data: guesses }] = await Promise.all([
                olympia
                    .from('obstacle_tiles')
                    .select('id, obstacle_id, round_question_id, position_index, is_open')
                    .eq('obstacle_id', obstacle.id)
                    .order('position_index', { ascending: true }),
                olympia
                    .from('obstacle_guesses')
                    .select('id, obstacle_id, player_id, guess_text, is_correct, attempt_order, attempted_at')
                    .eq('obstacle_id', obstacle.id)
                    .order('attempted_at', { ascending: false })
                    .limit(20),
            ])

            return { obstacle, tiles: tiles ?? [], guesses: guesses ?? [] }
        })()
        : { obstacle: null, tiles: [], guesses: [] }

    return {
        payload: {
            session: resolvedSession,
            match,
            players: players ?? [],
            scores: scores ?? [],
            roundQuestions: roundQuestions ?? [],
            buzzerEvents: buzzerEvents ?? [],
            obstacle: obstacleBundle.obstacle,
            obstacleTiles: obstacleBundle.tiles,
            obstacleGuesses: obstacleBundle.guesses,
            serverTimestamp: new Date().toISOString(),
            viewerUserId: null,
        },
        joinCode: resolvedSession.join_code ?? null,
        matchName: match.name,
    }
}

export default async function OlympiaGuestWatchPage({ params }: GuestPageProps) {
    const { supabase } = await getServerAuthContext()
    const { payload, joinCode } = await getGuestSessionData(supabase, params.matchId)
    if (!payload) {
        notFound()
    }

    const match = payload.match
    const session = payload.session
    const players = payload.players
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
                        {joinCode ? (
                            <div className="space-y-2">
                                <p className="text-3xl font-mono font-bold text-green-600 tracking-widest text-center">{joinCode}</p>
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
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">📺 Màn hình công khai (realtime)</CardTitle>
                    <CardDescription>Hiển thị timer, trạng thái câu hỏi, buzzer và bảng điểm.</CardDescription>
                </CardHeader>
                <CardContent>
                    <OlympiaGameClient initialData={payload} sessionId={payload.session.id} allowGuestFallback />
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline">
                    <Link href="/olympia/client/matches">← Quay lại danh sách</Link>
                </Button>
                {isLive && joinCode && (
                    <Button asChild className="gap-2 bg-green-600 hover:bg-green-700">
                        <Link href={`/olympia/client/game/${joinCode}`}>
                            <Radio className="h-4 w-4" />
                            Tham gia trò chơi (nếu là thí sinh)
                        </Link>
                    </Button>
                )}
            </div>
        </section>
    )
}
