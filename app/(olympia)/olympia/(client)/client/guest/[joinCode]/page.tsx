import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { OlympiaGameClient } from '@/components/olympia/shared/game/OlympiaGameClient'
import { resolveDisplayNamesForUserIds } from '@/lib/olympia-display-names'
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
    joinCode: string
): Promise<{ payload: GameSessionPayload | null; joinCode: string | null; matchName: string | null }> {
    const olympia = supabase.schema('olympia')

    const { data: session, error: sessionError } = await olympia
        .from('live_sessions')
        .select(
            'id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline, requires_player_password, buzzer_enabled, show_scoreboard_overlay, guest_media_control'
        )
        .eq('join_code', joinCode)
        .maybeSingle()

    if (sessionError) {
        console.error('[Olympia][Guest] load live session failed', sessionError.message)
    }

    if (!session?.match_id) {
        return { payload: null, joinCode: session?.join_code ?? null, matchName: null }
    }

    const { data: match, error: matchError } = await olympia
        .from('matches')
        .select('id, name, status, scheduled_at')
        .eq('id', session.match_id)
        .maybeSingle()

    if (matchError) {
        console.error('[Olympia][Guest] load match failed', matchError.message)
    }

    if (!match) {
        return { payload: null, joinCode: session?.join_code ?? null, matchName: null }
    }

    // Ensure we have a live session if possible
    const resolvedSession = session

    const [{ data: players }, { data: scores }, { data: roundQuestions }, { data: buzzerEvents }, { data: starUses }] =
        await Promise.all([
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
                    'id, match_round_id, question_id, question_set_item_id, order_index, target_player_id, meta, question_text, answer_text, note, questions(id, code, category, question_text, answer_text, note, image_url, audio_url), question_set_items(id, code, category, question_text, answer_text, note, image_url, audio_url), match_rounds!inner(match_id, round_type)'
                )
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
            olympia
                .from('star_uses')
                .select('id, match_id, round_question_id, player_id, outcome, declared_at')
                .eq('match_id', match.id),
        ])

    const obstacleBundle = { obstacle: null, tiles: [], guesses: [] }

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
        payload: {
            session: resolvedSession,
            match,
            players: normalizedPlayers,
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

export default async function OlympiaGuestPage({ params }: GuestPageProps) {
    const supabase = await getServerSupabase()
    const resolvedParams = await params
    const joinCode = (resolvedParams.joinCode ?? '').trim().toUpperCase()
    const { payload, matchName } = await getGuestSessionData(supabase, joinCode)

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
