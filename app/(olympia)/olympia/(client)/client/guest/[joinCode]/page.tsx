import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { OlympiaGameClient } from '@/components/olympia/shared/game/OlympiaGameClient'
import { getServerSupabase } from '@/lib/server-auth'
import type { GameSessionPayload } from '@/types/olympia/game'

// KEEP force-dynamic: Real-time match state
export const dynamic = 'force-dynamic'

type GuestPageProps = {
    params: Promise<{
        joinCode: string
    }>
}

async function getGuestSessionData(
    supabase: SupabaseClient,
    joinCodeOrMatchId: string
): Promise<{ payload: GameSessionPayload | null; joinCode: string | null; matchName: string | null }> {
    const olympia = supabase.schema('olympia')

    const { data: session } = await olympia
        .from('live_sessions')
        .select(
            'id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline, requires_player_password, buzzer_enabled, show_scoreboard_overlay'
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
                'id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline, requires_player_password, buzzer_enabled, show_scoreboard_overlay'
            )
            .eq('match_id', match.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()).data

    if (!resolvedSession) {
        return { payload: null, joinCode: null, matchName: match.name }
    }

    const [{ data: players }, { data: scores }, { data: roundQuestions }, { data: buzzerEvents }, { data: starUses }] = await Promise.all([
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
            .select(
                'id, match_round_id, question_id, question_set_item_id, order_index, target_player_id, meta, question_text, answer_text, note, questions(id, code, category, question_text, answer_text, note), match_rounds!inner(match_id, round_type)'
            )
            .eq('match_rounds.match_id', match.id)
            .order('order_index', { ascending: true }),
        resolvedSession.current_round_question_id
            ? olympia
                .from('buzzer_events')
                .select('id, match_id, round_question_id, player_id, event_type, result, occurred_at, created_at')
                .eq('round_question_id', resolvedSession.current_round_question_id)
                .order('occurred_at', { ascending: false })
                .limit(20)
            : Promise.resolve({ data: [] }),
        olympia
            .from('star_uses')
            .select('id, match_id, round_question_id, player_id, outcome, declared_at')
            .eq('match_id', match.id),
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
            starUses: starUses ?? [],
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
    const supabase = await getServerSupabase()
    const resolvedParams = await params
    const { payload, matchName } = await getGuestSessionData(supabase, resolvedParams.joinCode)
    if (!payload) {
        return (
            <section className="mx-auto max-w-2xl px-4 py-8 space-y-4">
                <Alert>
                    <AlertTitle>Không thể mở chế độ khách</AlertTitle>
                    <AlertDescription>
                        {matchName
                            ? `Trận "${matchName}" chưa mở phòng live hoặc chưa có dữ liệu để xem.`
                            : 'Không tìm thấy phòng/trận với mã bạn cung cấp.'}
                    </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/olympia/client/join">Về trang tham gia</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/olympia/client/matches">Xem danh sách trận</Link>
                    </Button>
                </div>
            </section>
        )
    }

    return (
        <OlympiaGameClient
            initialData={payload}
            sessionId={payload.session.id}
            allowGuestFallback
            viewerMode="guest"
        />
    )
}
