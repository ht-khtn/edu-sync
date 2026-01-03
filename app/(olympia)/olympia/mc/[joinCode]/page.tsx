import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { OlympiaGameClient } from '@/components/olympia/shared/game'
import { SessionInfoSidebar } from '@/components/olympia/client/game/SessionInfoSidebar'
import { McPasswordGate } from '@/components/olympia/shared/McPasswordGate'
import { resolveDisplayNamesForUserIds } from '@/lib/olympia-display-names'
import { getServerSupabase } from '@/lib/server-auth'
import type { AnswerRow, GameSessionPayload } from '@/types/olympia/game'

export const dynamic = 'force-dynamic'

type PageProps = {
    params: Promise<{
        joinCode: string
    }>
}

async function getMcSessionData(supabase: SupabaseClient, joinCode: string): Promise<GameSessionPayload | null> {
    const olympia = supabase.schema('olympia')

    const { data: session, error: sessionError } = await olympia
        .from('live_sessions')
        .select(
            'id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline, requires_player_password, buzzer_enabled, show_scoreboard_overlay, guest_media_control'
        )
        .eq('join_code', joinCode)
        .maybeSingle()

    if (sessionError) {
        console.error('[Olympia][MC] load live session failed', sessionError.message)
        return null
    }

    if (!session?.match_id) {
        return null
    }

    const [{ data: match, error: matchError }, { data: players, error: playersError }] = await Promise.all([
        olympia.from('matches').select('id, name, status, scheduled_at').eq('id', session.match_id).maybeSingle(),
        olympia
            .from('match_players')
            .select('id, match_id, participant_id, seat_index, display_name, is_disqualified_obstacle')
            .eq('match_id', session.match_id)
            .order('seat_index', { ascending: true }),
    ])

    if (matchError) {
        console.error('[Olympia][MC] load match failed', matchError.message)
        return null
    }

    if (!match) {
        return null
    }

    if (playersError) {
        console.warn('[Olympia][MC] load players failed', playersError.message)
    }

    const [{ data: scores }, { data: roundQuestions }, { data: buzzerEvents }, { data: starUses }, { data: answers }, obstacleBundle] = await Promise.all([
        olympia.from('match_scores').select('id, match_id, player_id, round_type, points').eq('match_id', session.match_id),
        olympia
            .from('round_questions')
            .select(
                'id, match_round_id, question_id, question_set_item_id, order_index, target_player_id, meta, question_text, answer_text, note, questions(id, code, category, question_text, answer_text, note, image_url, audio_url), question_set_items(id, code, category, question_text, answer_text, note, image_url, audio_url), match_rounds!inner(match_id, round_type)'
            )
            .eq('match_rounds.match_id', session.match_id)
            .order('order_index', { ascending: true }),
        session.current_round_question_id
            ? olympia
                .from('buzzer_events')
                .select('id, match_id, round_question_id, player_id, event_type, result, occurred_at')
                .eq('round_question_id', session.current_round_question_id)
                .order('occurred_at', { ascending: false })
                .limit(20)
            : Promise.resolve({ data: [] }),
        olympia
            .from('star_uses')
            .select('id, match_id, round_question_id, player_id, outcome, declared_at')
            .eq('match_id', session.match_id),
        session.current_round_question_id
            ? olympia
                .from('answers')
                .select('id, match_id, match_round_id, round_question_id, player_id, answer_text, is_correct, points_awarded, response_time_ms, submitted_at')
                .eq('round_question_id', session.current_round_question_id)
                .order('submitted_at', { ascending: false })
                .limit(20)
            : Promise.resolve({ data: [] }),
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

    const participantIds = (players ?? [])
        .map((p) => (p as { participant_id?: string | null }).participant_id ?? null)
        .filter((id): id is string => Boolean(id))
    const nameMap = await resolveDisplayNamesForUserIds(supabase, participantIds)
    const normalizedPlayers = (players ?? []).map((p) => {
        const row = p as { participant_id?: string | null; display_name?: string | null }
        const pid = row.participant_id ?? null
        const resolved = pid ? nameMap.get(pid) ?? null : null
        return { ...p, display_name: row.display_name ?? resolved }
    })

    return {
        session,
        match,
        players: normalizedPlayers,
        scores: scores ?? [],
        roundQuestions: roundQuestions ?? [],
        buzzerEvents: buzzerEvents ?? [],
        answers: (answers as AnswerRow[] | null) ?? [],
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

export default async function OlympiaMcJoinCodePage({ params }: PageProps) {
    // MC view cho phép mọi người truy cập (không bắt buộc là thí sinh / không cần đăng nhập).
    const supabase = await getServerSupabase()

    const resolvedParams = await params
    const joinCode = (resolvedParams.joinCode ?? '').trim().toUpperCase()
    if (!joinCode) {
        notFound()
    }

    const data = await getMcSessionData(supabase, joinCode)
    if (!data) {
        notFound()
    }

    const sessionStatus = data.session.status
    const sessionIsRunning = sessionStatus === 'running'

    return (
        <McPasswordGate joinCode={data.session.join_code ?? joinCode}>
            <div className="min-h-screen">
                {!sessionIsRunning ? (
                    <div className="mx-auto max-w-7xl px-4 py-4">
                        <Alert className="border-amber-200 bg-amber-50">
                            <AlertTitle>Phòng chưa mở</AlertTitle>
                            <AlertDescription>
                                Trạng thái hiện tại: {statusLabel[sessionStatus] ?? sessionStatus}. Bạn có thể ở lại trang này, hệ thống sẽ cập nhật ngay khi host mở câu hỏi.
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : null}

                <div className="mx-auto max-w-7xl px-4 py-6">
                    <div className="grid gap-6 lg:grid-cols-4">
                        <div className="lg:col-span-3">
                            <OlympiaGameClient
                                initialData={{ ...data, viewerUserId: null }}
                                sessionId={data.session.id}
                                viewerMode="mc"
                            />
                        </div>

                        <aside className="lg:sticky lg:top-6 lg:h-fit">
                            <SessionInfoSidebar session={data.session} match={data.match} playerCount={data.players.length} />
                        </aside>
                    </div>
                </div>
            </div>
        </McPasswordGate>
    )
}
