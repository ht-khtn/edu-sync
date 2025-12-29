import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getServerAuthContext } from '@/lib/server-auth'
import { cache } from 'react'
import { Clock, Calendar, Trophy, Radio } from 'lucide-react'
import { cn } from '@/utils/cn'

// ISR: Revalidate every 60 seconds
export const revalidate = 60

const formatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeStyle: 'short' })

const matchStatusLabel: Record<string, string> = {
    scheduled: 'Chưa diễn ra',
    live: 'Đang diễn ra',
    finished: 'Đã kết thúc',
}

const matchStatusColor: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
    scheduled: 'outline',
    live: 'default',
    finished: 'secondary',
}

type MatchesPayload = {
    upcomingMatches: Array<{
        id: string
        code?: string | null
        name: string
        status: string
        scheduled_at: string | null
    }>
    pastMatches: Array<{
        id: string
        name: string
        status: string
        scheduled_at: string | null
    }>
    sessions: Array<{
        id: string
        match_id: string
        status: string
        join_code: string
    }>
    error?: string
}

const fetchAllMatches = cache(async (): Promise<MatchesPayload> => {
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')

    try {
        const { data: allMatches, error } = await olympia
            .from('matches')
            // TODO: change matches.code to sessions.join_code in client view
            .select('id, code, name, status, scheduled_at')
            .order('scheduled_at', { ascending: false, nullsFirst: true })

        if (error) {
            console.error('[Olympia] Không tải được danh sách trận:', error.message)
            return {
                upcomingMatches: [],
                pastMatches: [],
                sessions: [],
                error: 'Không thể tải danh sách trận. Vui lòng thử lại sau.',
            }
        }

        const matches = allMatches ?? []
        const now = new Date()

        const upcomingMatches = matches.filter((m) => {
            if (m.status === 'finished') return false
            if (!m.scheduled_at) return true
            return new Date(m.scheduled_at) > now
        })

        const pastMatches = matches.filter((m) => {
            if (m.status === 'finished') return true
            if (!m.scheduled_at) return false
            return new Date(m.scheduled_at) <= now
        })

        // Fetch live sessions for all matches
        const { data: sessions } = await olympia
            .from('live_sessions')
            .select('id, match_id, status, join_code')
            .in(
                'match_id',
                matches.map((m) => m.id)
            )

        return {
            upcomingMatches,
            pastMatches,
            sessions: sessions ?? [],
        }
    } catch (error) {
        console.error('[Olympia] Fetch matches error:', error)
        return {
            upcomingMatches: [],
            pastMatches: [],
            sessions: [],
            error: 'Có lỗi khi tải danh sách trận.',
        }
    }
})

function MatchCard({
    match,
    session,
}: {
    match: MatchesPayload['upcomingMatches'][0]
    session?: MatchesPayload['sessions'][0]
}) {
    const scheduledDate = match.scheduled_at ? new Date(match.scheduled_at) : null
    const isLive = match.status === 'live' && session?.status === 'running'

    return (
        <Card className={cn('transition-all', isLive && 'border-2 border-green-400 bg-green-50')}>
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{match.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                            <Clock className="h-4 w-4" />
                            {scheduledDate ? formatter.format(scheduledDate) : 'Chưa xác định lịch'}
                        </CardDescription>
                    </div>
                    <Badge variant={matchStatusColor[match.status]} className={cn(isLive && 'animate-pulse')}>
                        {matchStatusLabel[match.status] ?? match.status}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent>
                {isLive && session ? (
                    <Button asChild className="w-full gap-2 bg-green-600 hover:bg-green-700">
                        <Link href={`/olympia/client/game/${session.join_code}`}>
                            <Radio className="h-4 w-4" />
                            Xem trực tiếp
                        </Link>
                    </Button>
                ) : (
                    <Button asChild variant="outline" className="w-full">
                        <Link href={`/olympia/client/watch/${session?.join_code ?? match.id}`}>Xem chi tiết</Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}

export default async function OlympiaMatchesPage() {
    const { upcomingMatches, pastMatches, sessions, error } = await fetchAllMatches()

    const sessionByMatchId = new Map(sessions.map((s) => [s.match_id, s]))

    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">📅 Lịch thi Olympia</h1>
                <p className="text-lg text-muted-foreground">Xem toàn bộ danh sách trận thi trắc nghiệm</p>
            </div>

            {error ? (
                <Alert variant="destructive">
                    <AlertTitle>Không thể tải dữ liệu</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}

            <Tabs defaultValue="upcoming" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upcoming" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Sắp tới ({upcomingMatches.length})
                    </TabsTrigger>
                    <TabsTrigger value="past" className="flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        Đã diễn ra ({pastMatches.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="upcoming" className="space-y-4">
                    {upcomingMatches.length === 0 ? (
                        <Alert>
                            <AlertTitle>Không có trận sắp tới</AlertTitle>
                            <AlertDescription>Hiện tại không có trận nào sắp diễn ra. Hãy kiểm tra lại sau.</AlertDescription>
                        </Alert>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {upcomingMatches.map((match) => (
                                <MatchCard key={match.id} match={match} session={sessionByMatchId.get(match.id)} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="past" className="space-y-4">
                    {pastMatches.length === 0 ? (
                        <Alert>
                            <AlertTitle>Chưa có trận nào kết thúc</AlertTitle>
                            <AlertDescription>Các trận thi đã hoàn thành sẽ hiển thị tại đây.</AlertDescription>
                        </Alert>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {pastMatches.map((match) => (
                                <MatchCard key={match.id} match={match} session={sessionByMatchId.get(match.id)} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </section>
    )
}
