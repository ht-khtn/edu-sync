import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { OlympiaGameClient } from '@/components/olympia/shared/game/OlympiaGameClient'
import { PlayerPasswordGate } from '@/components/olympia/client/game/PlayerPasswordGate'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { resolveDisplayNamesForUserIds } from '@/lib/olympia-display-names'
import { getServerAuthContext } from '@/lib/server-auth'
import type { GameSessionPayload } from '@/types/olympia/game'

// KEEP force-dynamic: Real-time game state (timer, scores, questions update per-second)
export const dynamic = 'force-dynamic'

type PageProps = {
    params: {
        joinCode: string
    }
}

async function getGameSessionData(supabase: SupabaseClient, sessionId: string): Promise<GameSessionPayload | null> {
    const olympia = supabase.schema('olympia')
    const selectWithGuestMediaControl =
        'id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline, requires_player_password, buzzer_enabled, show_scoreboard_overlay, guest_media_control'
    const selectWithoutGuestMediaControl =
        'id, match_id, status, join_code, question_state, current_round_id, current_round_type, current_round_question_id, timer_deadline, requires_player_password, buzzer_enabled, show_scoreboard_overlay'

    const firstAttempt = await olympia
        .from('live_sessions')
        .select(selectWithGuestMediaControl)
        .eq('join_code', sessionId)
        .maybeSingle()

    const shouldRetryWithoutGuestMediaControl =
        firstAttempt.error?.message != null &&
        firstAttempt.error.message.toLowerCase().includes('guest_media_control')

    const { data: session, error: sessionError } = shouldRetryWithoutGuestMediaControl
        ? await olympia.from('live_sessions').select(selectWithoutGuestMediaControl).eq('join_code', sessionId).maybeSingle()
        : firstAttempt

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

    const [{ data: scores }, { data: roundQuestions }, { data: buzzerEvents }, { data: starUses }] = await Promise.all([
        olympia
            .from('match_scores')
            .select('id, match_id, player_id, round_type, points')
            .eq('match_id', session.match_id),
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
        starUses: starUses ?? [],
        obstacle: null,
        obstacleTiles: [],
        obstacleGuesses: [],
        serverTimestamp: new Date().toISOString(),
        viewerUserId: null,
    }
}

export default async function OlympiaGamePage({ params }: PageProps) {
    const { supabase, authUid, appUserId } = await getServerAuthContext()
    const { joinCode } = await params
    if (!joinCode) {
        notFound()
    }

    const data = await getGameSessionData(supabase, joinCode)
    if (!data) {
        notFound()
    }

    // Chặn: chỉ thí sinh thuộc match_players mới được vào mode player.
    // Nếu user đã đăng nhập nhưng chưa có appUserId (chưa kích hoạt trong hệ thống) => cũng chặn.
    if (authUid) {
        const isMember =
            appUserId != null &&
            (data.players ?? []).some((p) => {
                const pid = (p as { participant_id?: string | null }).participant_id ?? null
                return pid === appUserId
            })

        if (!isMember) {
            return (
                <section className="mx-auto max-w-2xl px-4 py-8 space-y-4">
                    <Alert>
                        <AlertTitle>Bạn không thuộc phòng thi này</AlertTitle>
                        <AlertDescription>
                            Tài khoản hiện tại không có trong danh sách thí sinh của trận. Bạn có thể xem ở chế độ khách hoặc quay lại trang tham gia.
                        </AlertDescription>
                    </Alert>

                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link href="/olympia/client/join">Về trang tham gia</Link>
                        </Button>
                        <Button asChild>
                            <Link href={`/olympia/client/guest/${encodeURIComponent(joinCode)}`}>Xem chế độ khách</Link>
                        </Button>
                    </div>
                </section>
            )
        }
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
    // UI game tự xử lý trạng thái phòng (running/pending/ended)

    return (
        <PlayerPasswordGate session={data.session} userAlreadyVerified={userAlreadyVerified}>
            <OlympiaGameClient
                initialData={{ ...data, viewerUserId: viewerId }}
                sessionId={data.session.id}
                allowGuestFallback={!authUid}
                viewerMode={!authUid ? 'guest' : 'player'}
            />
        </PlayerPasswordGate>
    )
}
