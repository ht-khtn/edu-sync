'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { Calendar, Clock, Radio } from 'lucide-react'

import getSupabase from '@/lib/supabase'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/utils/cn'

const formatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeStyle: 'short' })

const matchStatusLabel: Record<string, string> = {
    scheduled: 'Chưa diễn ra',
    live: 'Đang diễn ra',
    finished: 'Đã kết thúc',
}

const roundLabelMap: Record<string, string> = {
    khoi_dong: 'Khởi động',
    vcnv: 'Vượt chướng ngại vật',
    tang_toc: 'Tăng tốc',
    ve_dich: 'Về đích',
}

type MatchRow = {
    id: string
    name: string
    status: string
    scheduled_at: string | null
}

type LiveSessionRow = {
    id: string
    match_id: string
    join_code: string
    status: string
    question_state: string | null
    current_round_type: string | null
}

type RealtimeEventPayload = Record<string, string | number | boolean | null>

type RealtimeEventRow = {
    id: string
    match_id: string
    session_id: string | null
    entity: string
    entity_id: string | null
    event_type: string
    payload: RealtimeEventPayload
    created_at: string
}

function payloadString(payload: RealtimeEventPayload, key: string): string | null {
    const value = payload[key]
    return typeof value === 'string' ? value : null
}

export function LiveScheduleRealtime({
    initialMatches,
    initialSessions,
}: {
    initialMatches: MatchRow[]
    initialSessions: LiveSessionRow[]
}) {
    const [matchesById, setMatchesById] = useState<Record<string, MatchRow>>(() => {
        const map: Record<string, MatchRow> = {}
        for (const m of initialMatches) map[m.id] = m
        return map
    })

    const [sessionByMatchId, setSessionByMatchId] = useState<Record<string, LiveSessionRow>>(() => {
        const map: Record<string, LiveSessionRow> = {}
        for (const s of initialSessions) map[s.match_id] = s
        return map
    })

    const matchIds = useMemo(() => Object.keys(matchesById), [matchesById])
    const supabaseRef = useRef<SupabaseClient | null>(null)
    const channelsRef = useRef<RealtimeChannel[]>([])

    useEffect(() => {
        let mounted = true

        const cleanup = async () => {
            const supabase = supabaseRef.current
            const channels = channelsRef.current
            channelsRef.current = []
            if (!supabase || channels.length === 0) return
            try {
                for (const ch of channels) supabase.removeChannel(ch)
            } catch {
                for (const ch of channels) {
                    try {
                        await ch.unsubscribe()
                    } catch {
                        // ignore
                    }
                }
            }
        }

        const applyEvent = (row: RealtimeEventRow) => {
            if (!mounted) return

            if (row.entity === 'matches') {
                const status = payloadString(row.payload, 'status')
                const scheduledAt = payloadString(row.payload, 'scheduledAt')
                if (!status && !scheduledAt) return

                setMatchesById((prev) => {
                    const existing = prev[row.match_id]
                    if (!existing) return prev
                    const next: MatchRow = {
                        ...existing,
                        status: status ?? existing.status,
                        scheduled_at: scheduledAt ?? existing.scheduled_at,
                    }
                    return { ...prev, [row.match_id]: next }
                })
                return
            }

            if (row.entity === 'live_sessions') {
                const sessionStatus = payloadString(row.payload, 'status')
                const joinCode = payloadString(row.payload, 'joinCode')
                const questionState = payloadString(row.payload, 'questionState')
                const currentRoundType = payloadString(row.payload, 'currentRoundType')
                const sessionId = payloadString(row.payload, 'id')

                setSessionByMatchId((prev) => {
                    const existing = prev[row.match_id]
                    const base: LiveSessionRow = existing ?? {
                        id: sessionId ?? row.session_id ?? '',
                        match_id: row.match_id,
                        join_code: joinCode ?? '',
                        status: sessionStatus ?? 'waiting',
                        question_state: questionState,
                        current_round_type: currentRoundType,
                    }

                    const next: LiveSessionRow = {
                        ...base,
                        id: sessionId ?? base.id,
                        join_code: joinCode ?? base.join_code,
                        status: sessionStatus ?? base.status,
                        question_state: questionState ?? base.question_state,
                        current_round_type: currentRoundType ?? base.current_round_type,
                    }

                    return { ...prev, [row.match_id]: next }
                })
            }
        }

        const subscribe = async () => {
            await cleanup()

            if (matchIds.length === 0) return

            try {
                const supabase = supabaseRef.current ?? (await getSupabase())
                supabaseRef.current = supabase
                if (!mounted) return

                const channels: RealtimeChannel[] = []
                for (const matchId of matchIds) {
                    const ch = supabase
                        .channel(`olympia-schedule-events-${matchId}`)
                        .on(
                            'postgres_changes',
                            {
                                event: 'INSERT',
                                schema: 'olympia',
                                table: 'realtime_events',
                                filter: `match_id=eq.${matchId}`,
                            },
                            (payload) => {
                                const row = (payload.new ?? null) as RealtimeEventRow | null
                                if (!row) return
                                if (row.match_id !== matchId) return
                                applyEvent(row)
                            }
                        )
                    ch.subscribe()
                    channels.push(ch)
                }

                channelsRef.current = channels
            } catch (error) {
                console.warn('[Olympia] Không thể subscribe realtime schedule:', error)
            }
        }

        void subscribe()

        return () => {
            mounted = false
            void cleanup()
        }
    }, [matchIds])

    const matches = useMemo(() => {
        const arr = Object.values(matchesById)
        arr.sort((a, b) => {
            const at = a.scheduled_at ? Date.parse(a.scheduled_at) : Number.POSITIVE_INFINITY
            const bt = b.scheduled_at ? Date.parse(b.scheduled_at) : Number.POSITIVE_INFINITY
            if (at !== bt) return at - bt
            return a.name.localeCompare(b.name)
        })
        return arr
    }, [matchesById])

    return (
        <div>
            <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
                <Calendar className="h-6 w-6" />
                Lịch thi sắp tới
            </h2>

            {matches.length === 0 ? (
                <Alert>
                    <AlertTitle>Chưa có lịch thi</AlertTitle>
                    <AlertDescription>
                        Khi ban tổ chức chuyển trận sang trạng thái scheduled hoặc live, lịch thi sẽ hiển thị tại đây.
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {matches.map((match) => {
                        const session = sessionByMatchId[match.id]
                        const isLive = match.status === 'live' && session?.status === 'running'
                        const scheduledDate = match.scheduled_at ? new Date(match.scheduled_at) : null

                        return (
                            <Card key={match.id} className={cn('border-2 transition-all', isLive && 'border-green-400 bg-green-50')}>
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <CardTitle className="text-lg truncate">{match.name}</CardTitle>
                                            <CardDescription className="flex items-center gap-1 mt-1">
                                                <Clock className="h-4 w-4" />
                                                {scheduledDate ? formatter.format(scheduledDate) : 'Chưa xác định lịch'}
                                            </CardDescription>
                                        </div>
                                        <Badge
                                            variant={isLive ? 'default' : match.status === 'finished' ? 'secondary' : 'outline'}
                                            className={cn(isLive && 'animate-pulse')}
                                        >
                                            {isLive && <Radio className="h-3 w-3 mr-1" />}
                                            {matchStatusLabel[match.status] ?? match.status}
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    {isLive && session ? (
                                        <div className="space-y-3">
                                            <div className="rounded-lg border-2 border-green-300 bg-white p-3">
                                                <p className="text-xs font-semibold text-green-700 uppercase mb-1">📱 Mã tham gia</p>
                                                <p className="text-2xl font-mono font-bold text-green-900 tracking-widest">{session.join_code}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="rounded-md bg-slate-50 p-2">
                                                    <p className="text-xs text-muted-foreground">Vòng hiện tại</p>
                                                    <p className="font-semibold text-sm">
                                                        {session.current_round_type ? roundLabelMap[session.current_round_type] : '—'}
                                                    </p>
                                                </div>
                                                <div className="rounded-md bg-slate-50 p-2">
                                                    <p className="text-xs text-muted-foreground">Trạng thái câu</p>
                                                    <p className="font-semibold text-sm">{session.question_state ?? '—'}</p>
                                                </div>
                                            </div>

                                            <Button asChild className="w-full gap-2 bg-green-600 hover:bg-green-700">
                                                <Link href={`/olympia/client/game/${session.join_code}`}>
                                                    <Radio className="h-4 w-4" />
                                                    Xem trực tiếp
                                                </Link>
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <p className="text-sm text-muted-foreground">
                                                {match.status === 'scheduled' ? 'Chờ thời gian diễn ra' : 'Phòng thi này đã kết thúc'}
                                            </p>
                                            {match.status === 'scheduled' && (
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Hãy quay lại trang này vào thời gian trận diễn ra để tham gia
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
