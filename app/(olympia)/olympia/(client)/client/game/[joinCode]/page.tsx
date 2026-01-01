import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { OlympiaGameClient } from '@/components/olympia/shared/game'
import { SessionInfoSidebar } from '@/components/olympia/client/game/SessionInfoSidebar'
import { PlayerPasswordGate } from '@/components/olympia/client/game/PlayerPasswordGate'
import { getServerAuthContext } from '@/lib/server-auth'
import type { GameSessionPayload } from '@/types/olympia/game'

// KEEP force-dynamic: Real-time game state (timer, scores, questions update per-second)
export const dynamic = 'force-dynamic'

type PageProps = {
    params: {
        sessionId: string
    }
}

async function getGameSessionData(supabase: SupabaseClient, sessionId: string): Promise<GameSessionPayload | null> {
    const olympia = supabase.schema('olympia')
    const { data: session, error: sessionError } = await olympia
        .from('live_sessions')
        .select(
            'id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline, requires_player_password'
        )
        .eq('join_code', sessionId)
        .maybeSingle()

    if (sessionError) {
        console.error('[Olympia] load live session failed', sessionError.message)
        return null
    }

    if (!session) {
        console.error(`[Olympia] Session not found: ${sessionId}`)
        return null
    }

    if (!session.match_id) {
        console.error(`[Olympia] Session has no match_id: ${sessionId}`)
        return null
    }

    const [{ data: match, error: matchError }, { data: players, error: playersError }] = await Promise.all([
        olympia
            .from('matches')
            .select('id, name, status, scheduled_at')
            .eq('id', session.match_id)
            .maybeSingle(),
        olympia
            .from('match_players')
            .select('id, match_id, participant_id, seat_index, display_name, is_disqualified_obstacle')
            .eq('match_id', session.match_id)
            .order('seat_index', { ascending: true }),
    ])

    if (matchError) {
        console.error('[Olympia] load match failed', matchError.message)
        return null
    }

    if (!match) {
        console.error(`[Olympia] Match not found for match_id: ${session.match_id}`)
        return null
    }

    if (playersError) {
        console.warn('[Olympia] load players failed', playersError.message)
    }

    const [{ data: scores }, { data: roundQuestions }, { data: buzzerEvents }, { data: starUses }, obstacleBundle] = await Promise.all([
        olympia
            .from('match_scores')
            .select('id, match_id, player_id, round_type, points')
            .eq('match_id', session.match_id),
        olympia
            .from('round_questions')
            .select('id, match_round_id, question_id, order_index, target_player_id, meta, match_rounds!inner(match_id, round_type)')
            .eq('match_rounds.match_id', session.match_id)
            .order('order_index', { ascending: true }),
        session.current_round_question_id
            ? olympia
                .from('buzzer_events')
                .select('id, match_id, round_question_id, player_id, event_type, result, occurred_at, created_at')
                .eq('round_question_id', session.current_round_question_id)
                .order('occurred_at', { ascending: false })
                .limit(20)
            : Promise.resolve({ data: [] }),
        olympia
            .from('star_uses')
            .select('id, match_id, round_question_id, player_id, outcome, declared_at')
            .eq('match_id', session.match_id),
        session.current_round_id
            ? (async () => {
                const { data: obstacle } = await olympia
                    .from('obstacles')
                    .select('id, match_round_id, title, final_keyword, image_url, meta')
                    .eq('match_round_id', session.current_round_id)
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
            : Promise.resolve({ obstacle: null, tiles: [], guesses: [] }),
    ])

    return {
        session,
        match,
        players: players ?? [],
        scores: scores ?? [],
        roundQuestions: roundQuestions ?? [],
        buzzerEvents: buzzerEvents ?? [],
        starUses: starUses ?? [],
        obstacle: obstacleBundle.obstacle,
        obstacleTiles: obstacleBundle.tiles,
        obstacleGuesses: obstacleBundle.guesses,
        serverTimestamp: new Date().toISOString(),
        viewerUserId: null,
    }
}

const statusLabel: Record<string, string> = {
    running: 'Đang mở',
    pending: 'Chờ mở',
    ended: 'Đã kết thúc',
}

export default async function OlympiaGamePage({ params }: PageProps) {
    const { supabase, authUid, appUserId } = await getServerAuthContext()
    const { sessionId } = await params
    if (!sessionId) {
        notFound()
    }

    const data = await getGameSessionData(supabase, sessionId)
    if (!data) {
        notFound()
    }

    // Check if user has already verified this session (cross-device persistence)
    let userAlreadyVerified = false
    if (authUid && data.session.requires_player_password) {
        const olympia = supabase.schema('olympia')
        const { data: verification } = await olympia
            .from('session_verifications')
            .select('id')
            .eq('session_id', data.session.id)
            .eq('user_id', authUid)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle()

        userAlreadyVerified = !!verification
    }

    const viewerId = appUserId ?? null
    const sessionStatus = data.session.status
    const sessionIsRunning = sessionStatus === 'running'

    return (
        <PlayerPasswordGate session={data.session} userAlreadyVerified={userAlreadyVerified}>
            <div className="min-h-screen">
                {!authUid ? (
                    <div className="mx-auto max-w-7xl px-4 py-4">
                        <Alert>
                            <AlertTitle>Yêu cầu đăng nhập</AlertTitle>
                            <AlertDescription>Vui lòng đăng nhập để đồng bộ tiến trình thi và gửi đáp án.</AlertDescription>
                        </Alert>
                    </div>
                ) : null}

                {!sessionIsRunning ? (
                    <div className="mx-auto max-w-7xl px-4 py-4">
                        <Alert className="border-amber-200 bg-amber-50">
                            <AlertTitle>Phòng chưa mở</AlertTitle>
                            <AlertDescription>
                                Trạng thái hiện tại: {statusLabel[sessionStatus] ?? sessionStatus}. Bạn có thể ở lại trang này, hệ thống sẽ cập nhật ngay khi
                                host mở câu hỏi.
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : null}

                <div className="mx-auto max-w-7xl px-4 py-6">
                    <div className="grid gap-6 lg:grid-cols-4">
                        <div className="lg:col-span-3">
                            <OlympiaGameClient initialData={{ ...data, viewerUserId: viewerId }} sessionId={data.session.id} allowGuestFallback={!authUid} />
                        </div>

                        <aside className="lg:sticky lg:top-6 lg:h-fit">
                            <SessionInfoSidebar session={data.session} match={data.match} playerCount={data.players.length} />
                        </aside>
                    </div>
                </div>
            </div>
        </PlayerPasswordGate>
    )
}
