import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// Table components not used on this page
import { LiveSessionControls } from '@/components/olympia/admin/matches/LiveSessionControls'
import { ResetLiveSessionAndScoresButton } from '@/components/olympia/admin/matches/ResetLiveSessionAndScoresButton'
import { MatchQuestionSetSelector } from '@/components/olympia/admin/matches/MatchQuestionSetSelector'
import { MatchPlayersReorder } from '@/components/olympia/admin/matches/MatchPlayersReorder'
import { AddPlayersToMatch } from '@/components/olympia/admin/matches/AddPlayersToMatch'
import { CopyMatchIdButton } from '@/components/olympia/admin/matches/CopyMatchIdButton'
import { CopyRoomLinksPanel } from '@/components/olympia/admin/matches/CopyRoomLinksPanel'
import { getServerAuthContext } from '@/lib/server-auth'
import { resetLiveSessionAndScoresAction } from '@/app/(olympia)/olympia/actions'

// Force dynamic to avoid timing issues with Turbopack performance measurements
export const dynamic = 'force-dynamic'
// ISR: Match detail page. Real-time handled by LiveSessionControls component.
export const revalidate = 30

const statusVariants: Record<string, string> = {
  draft: 'bg-slate-200 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  live: 'bg-green-100 text-green-700',
  finished: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

const roundLabel: Record<string, string> = {
  khoi_dong: 'Khởi động',
  vcnv: 'Vượt chướng ngại vật',
  tang_toc: 'Tăng tốc',
  ve_dich: 'Về đích',
}

const formatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'full',
  timeStyle: 'short',
})

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return formatter.format(new Date(value))
  } catch {
    return value
  }
}

// helper removed: class name extracted from user_profiles when enriching participants

async function fetchMatchDetail(matchId: string) {
  const { supabase } = await getServerAuthContext()
  const olympia = supabase.schema('olympia')

  const { data: match, error: matchError } = await olympia
    .from('matches')
    .select('id, name, status, scheduled_at, tournament_id, host_user_id, metadata, created_at, updated_at')
    .eq('id', matchId)
    .maybeSingle()

  if (matchError) throw matchError
  if (!match) return null

  const realMatchId = match.id

  const tournamentPromise = match.tournament_id
    ? olympia
      .from('tournaments')
      .select('id, name, status, starts_at, ends_at')
      .eq('id', match.tournament_id)
      .maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const [
    liveSessionResult,
    playersResult,
    roundsResult,
    tournamentResult,
    matchQuestionSetsResult,
    questionSetsResult,
    allParticipantsResult,
  ] = await Promise.all([
    olympia
      .from('live_sessions')
      .select('id, match_id, status, join_code, question_state, current_round_type, timer_deadline, requires_player_password')
      .eq('match_id', realMatchId)
      .maybeSingle(),
    olympia
      .from('match_players')
      .select('id, match_id, seat_index, display_name, participant_id, created_at')
      .eq('match_id', realMatchId)
      .order('seat_index', { ascending: true }),
    olympia
      .from('match_rounds')
      .select('id, round_type, order_index, config')
      .eq('match_id', realMatchId)
      .order('order_index', { ascending: true }),
    tournamentPromise,
    (async () => {
      try {
        return await olympia
          .from('match_question_sets')
          .select('question_set_id')
          .eq('match_id', matchId)
      } catch {
        return { data: [], error: null }
      }
    })(),
    (async () => {
      try {
        return await olympia
          .from('question_sets')
          .select('id, name, item_count, original_filename, created_at')
          .order('created_at', { ascending: false })
          .limit(50)
      } catch {
        return { data: [], error: null }
      }
    })(),
    (async () => {
      const { data, error } = await olympia
        .from('participants')
        .select('user_id, contestant_code, role')
        .order('contestant_code', { ascending: true })

      if (error) {
        console.error('[fetchMatchDetail] Error fetching participants:', error)
        return { data: [] as Array<Record<string, unknown>>, error }
      }

      // Fetch user data from public.users and classes for full info
      if (data && data.length > 0) {
        const userIds = (data as Array<Record<string, unknown>>).map((p) => p.user_id)

        // Query public schema users with their class names
        const publicSubabase = supabase
        const { data: userData } = await publicSubabase
          .from('users')
          .select('id, user_name, auth_uid, class_id, classes:class_id (name)')
          .in('id', userIds)

        // collect auth_uids to fetch full names from auth.users
        const authUids = (userData || [])
          .map((u: Record<string, unknown>) => (u.auth_uid as string | undefined))
          .filter(Boolean) as string[]

        let authUsers: Array<Record<string, unknown>> = []
        if (authUids.length > 0) {
          const { data: authData } = await publicSubabase
            .from('auth.users')
            .select('id, user_metadata')
            .in('id', authUids)
          authUsers = authData || []
        }

        const authMap = new Map((authUsers || []).map((a) => [a.id as string, a.user_metadata]))

        // fetch public.user_profiles to get full_name if available
        const { data: userProfiles } = await publicSubabase
          .from('user_profiles')
          .select('user_id, full_name')
          .in('user_id', userIds)
        const profilesMap = new Map(
          (userProfiles || []).map((r: Record<string, unknown>) => [r.user_id as string, r.full_name as string])
        )

        // Build lookup map enriched with full name and class
        const userMap = new Map((userData || []).map((u: Record<string, unknown>) => {
          const classes = u.classes as Record<string, unknown> | null
          const authMetaRaw = (u.auth_uid as string | undefined) ? authMap.get(u.auth_uid as string) : null
          let fullName: string | null = null
          if (authMetaRaw && typeof authMetaRaw === 'object') {
            const meta = authMetaRaw as Record<string, unknown>
            const maybeFull = meta['full_name'] ?? meta['display_name']
            if (typeof maybeFull === 'string') fullName = maybeFull
          }
          const profileFull = profilesMap.get(u.id as string) || null
          const displayName = profileFull || fullName || (u.user_name as string | null) || null
          return [
            u.id as string,
            {
              display_name: displayName,
              class_name: (classes as Record<string, unknown> | null)?.name || null
            }
          ]
        }))

        const enrichedData = (data as Array<Record<string, unknown>>).map((p) => {
          const userInfo = userMap.get(p.user_id as string) || { display_name: null, class_name: null }
          return {
            ...p,
            display_name: userInfo.display_name,
            class_name: userInfo.class_name
          }
        })

        console.log('[fetchMatchDetail] Fetched participants:', enrichedData.length, 'rows')
        return { data: enrichedData, error: null }
      }

      console.log('[fetchMatchDetail] Fetched participants: 0 rows')
      return { data: [] as Array<Record<string, unknown>>, error: null }
    })(),
  ])

  if (liveSessionResult.error) throw liveSessionResult.error
  if (playersResult.error) {
    console.warn('[Olympia] Failed to load match players:', playersResult.error.message)
  }
  if (roundsResult.error) throw roundsResult.error
  if (tournamentResult && tournamentResult.error) throw tournamentResult.error

  let participantLookup = new Map<
    string,
    {
      contestant_code: string | null
      role: string | null
      display_name?: string | null
      class_name?: string | null | Array<{ class_name: string | null }>
    }
  >()
  const playerParticipantIds = (playersResult.data ?? [])
    .map((player) => player.participant_id)
    .filter((value): value is string => Boolean(value))

  if (playerParticipantIds.length > 0) {
    const { data: participants, error: participantError } = await olympia
      .from('participants')
      .select('user_id, contestant_code, role')
      .in('user_id', playerParticipantIds)

    if (participantError) {
      console.warn('[Olympia] Failed to load participants:', participantError.message)
    } else if (participants && participants.length > 0) {
      type SimpleParticipant = { user_id: string; contestant_code?: string | null; role?: string | null }
      const participantsList = participants as SimpleParticipant[]
      const userIds = participantsList.map((p) => p.user_id)

      // Enrich user info from public.users, auth.users and user_profiles (same approach as allParticipants)
      const publicSubabase = supabase
      const { data: userData } = await publicSubabase
        .from('users')
        .select('id, user_name, auth_uid, class_id, classes:class_id (name)')
        .in('id', userIds)

      const authUids = (userData || [])
        .map((u: Record<string, unknown>) => (u.auth_uid as string | undefined))
        .filter(Boolean) as string[]

      let authUsers: Array<Record<string, unknown>> = []
      if (authUids.length > 0) {
        const { data: authData } = await publicSubabase
          .from('auth.users')
          .select('id, user_metadata')
          .in('id', authUids)
        authUsers = authData || []
      }

      const authMap = new Map((authUsers || []).map((a) => [a.id as string, a.user_metadata]))

      const { data: userProfiles } = await publicSubabase
        .from('user_profiles')
        .select('user_id, full_name')
        .in('user_id', userIds)
      const profilesMap = new Map(
        (userProfiles || []).map((r: Record<string, unknown>) => [r.user_id as string, r.full_name as string])
      )

      const userMap = new Map((userData || []).map((u: Record<string, unknown>) => {
        const classes = u.classes as Record<string, unknown> | null
        const authMetaRaw = (u.auth_uid as string | undefined) ? authMap.get(u.auth_uid as string) : null
        let fullName: string | null = null
        if (authMetaRaw && typeof authMetaRaw === 'object') {
          const meta = authMetaRaw as Record<string, unknown>
          const maybeFull = meta['full_name'] ?? meta['display_name']
          if (typeof maybeFull === 'string') fullName = maybeFull
        }
        const profileFull = profilesMap.get(u.id as string) || null
        const displayName = profileFull || fullName || (u.user_name as string | null) || null
        return [
          u.id as string,
          {
            display_name: displayName,
            class_name: ((classes as Record<string, unknown> | null)?.name as string) || null,
          },
        ]
      }))

      participantLookup = new Map(
        participantsList.map((participant) => {
          const userInfo = userMap.get(participant.user_id) || { display_name: null, class_name: null }
          return [
            participant.user_id,
            {
              contestant_code: participant.contestant_code ?? null,
              role: participant.role ?? null,
              display_name: userInfo.display_name,
              class_name: (userInfo.class_name as string) ?? null,
            },
          ]
        })
      )
    }
  } else {
    // Fallback: use enriched allParticipants result (already has display_name and class_name)
    type EnrichedParticipant = { user_id: string; contestant_code?: string | null; role?: string | null; display_name?: string | null; class_name?: string | null }
    const all = (allParticipantsResult.data ?? []) as EnrichedParticipant[]
    participantLookup = new Map(
      all.map((participant) => [
        participant.user_id,
        {
          contestant_code: participant.contestant_code ?? null,
          role: participant.role ?? null,
          display_name: participant.display_name ?? null,
          class_name: participant.class_name ?? null,
        },
      ])
    )
  }

  return {
    match,
    tournament: tournamentResult?.data ?? null,
    liveSession: liveSessionResult.data,
    players: playersResult.data ?? [],
    rounds: roundsResult.data ?? [],
    questionSets: questionSetsResult.data ?? [],
    selectedQuestionSetIds: (matchQuestionSetsResult.data ?? []).map((row) => row.question_set_id),
    participantLookup,
    allParticipants: allParticipantsResult.data ?? [],
  }
}

export default async function OlympiaMatchDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params

  // Match routes now use match UUID in the URL (not code). matchId is the match.id UUID.
  const details = await fetchMatchDetail(matchId)
  if (!details) {
    console.error('[OlympiaMatchDetailPage] Match not found in database:', matchId)
    notFound()
  }

  const { match, tournament, liveSession, players, rounds, participantLookup, questionSets, selectedQuestionSetIds } = details
  const statusClass = statusVariants[match.status] ?? 'bg-slate-100 text-slate-700'

  type ParticipantRow = {
    user_id: string
    contestant_code?: string | null
    display_name?: string | null
    user_profiles?: unknown
    role?: string | null
    class_name?: string | null
  }
  // Only include participants with role === null (contestants)
  const availableParticipants = ((details.allParticipants ?? []) as ParticipantRow[]).filter(
    (p) => p.role === null
  )

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Mã trận · {match.id}</p>
              <CopyMatchIdButton matchId={match.id} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{match.name}</h1>
            <div className="flex gap-3 text-sm text-muted-foreground">
              <span>Lịch dự kiến: {formatDate(match.scheduled_at)}</span>
              <span>· Cập nhật: {formatDate(match.updated_at)}</span>
            </div>
          </div>
          <Badge className={statusClass}>{match.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>Host: {match.host_user_id ?? '—'}</span>
          <span>Giải đấu: {tournament ? tournament.name : 'Chưa gán'}</span>
        </div>
        <div className="flex gap-3 text-sm">
          <Button asChild variant="ghost" size="sm">
            <Link href="/olympia/admin/matches">← Trở lại danh sách</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/olympia/admin">Về dashboard</Link>
          </Button>
          <Button asChild variant="default" size="sm">
            <Link href={`/olympia/admin/matches/${match.id}/host`}>Mở console host</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Phiên live hiện tại</CardTitle>
            <CardDescription>
              Mở hoặc kết thúc phòng thi để cập nhật realtime cho thí sinh và khán phòng trực tuyến.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <LiveSessionControls matchId={match.id} liveSession={liveSession ?? undefined} />
              <ResetLiveSessionAndScoresButton matchId={match.id} action={resetLiveSessionAndScoresAction} />
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Link phòng thi</CardTitle>
              <CardDescription>Copy nhanh link vào phòng thi cho thí sinh / MC / Guest.</CardDescription>
            </CardHeader>
            <CardContent>
              <CopyRoomLinksPanel joinCode={liveSession?.join_code ?? null} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thông tin giải đấu</CardTitle>
              <CardDescription>Giải mà trận này trực thuộc.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {tournament ? (
                <>
                  <p className="text-base font-medium text-slate-900">{tournament.name}</p>
                  <p>Trạng thái: {tournament.status ?? '—'}</p>
                  <p>Bắt đầu: {formatDate(tournament.starts_at)}</p>
                  <p>Kết thúc: {formatDate(tournament.ends_at)}</p>
                </>
              ) : (
                <p>Trận chưa được gán vào giải đấu cụ thể.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách thí sinh</CardTitle>
          <CardDescription>
            Kéo và thả để sắp xếp thứ tự ghế (1-4). Thay đổi sẽ được lưu ngay khi bấm &quot;Lưu thứ tự&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Quản lý thí sinh</h4>
            <AddPlayersToMatch
              matchId={match.id}
              availableParticipants={availableParticipants.map((p) => ({
                user_id: p.user_id,
                contestant_code: p.contestant_code ?? null,
                display_name: p.display_name ?? null,
                role: p.role ?? null,
                class_name: p.class_name ?? null,
              }))}
              currentPlayers={players}
            />
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Sắp xếp thứ tự</h4>
            <MatchPlayersReorder
              matchId={match.id}
              players={players}
              participantLookup={participantLookup}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bộ đề cho trận</CardTitle>
          <CardDescription>Chọn một hoặc nhiều bộ đề đã tải lên. Thay đổi sẽ áp dụng ngay cho trận này.</CardDescription>
        </CardHeader>
        <CardContent>
          <MatchQuestionSetSelector
            matchId={match.id}
            questionSets={questionSets}
            selectedIds={selectedQuestionSetIds}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cấu hình vòng thi</CardTitle>
          <CardDescription>Mỗi vòng tương ứng với cấu hình trong bảng olympia.match_rounds.</CardDescription>
        </CardHeader>
        <CardContent>
          {rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa cấu hình vòng thi cho trận này.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rounds.map((round) => (
                <div key={round.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold">
                    Vòng {round.order_index + 1}: {roundLabel[round.round_type] ?? round.round_type}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Config: {round.config ? JSON.stringify(round.config) : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
