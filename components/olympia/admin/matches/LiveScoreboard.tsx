
'use client'

import type { ReactNode } from 'react'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import getSupabase from '@/lib/supabase'

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

function payloadNumber(payload: RealtimeEventPayload, key: string): number | null {
  const value = payload[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

type ActionState = {
  error?: string | null
  success?: string | null
  data?: Record<string, unknown> | null
}

type ScoreboardAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>

const initialState: ActionState = { error: null, success: null }
const noopAction: ScoreboardAction = async (prevState) => prevState

type PlayerScore = {
  playerId: string
  displayName: string
  seatNumber?: number | null
  className?: string | null
  totalScore: number
  roundScores?: Record<string, number>
}

type Props = {
  matchId: string
  title?: ReactNode
  description?: ReactNode
  scores: PlayerScore[]
  initialScoreRows?: Array<{ id: string; player_id: string; points: number | null }>
  showRoundBreakdown?: boolean
  maxScore?: number
  resetScoresAction?: ScoreboardAction
  editScoreAction?: ScoreboardAction
}

export function LiveScoreboard({
  matchId,
  title = 'Bảng xếp hạng',
  description = 'Điểm số các thí sinh trong trận thi',
  scores,
  initialScoreRows,
  maxScore,
  resetScoresAction,
  editScoreAction,
}: Props) {
  const [resetState, resetFormAction, pendingReset] = useActionState(resetScoresAction ?? noopAction, initialState)
  const [editState, editFormAction, pendingEdit] = useActionState(editScoreAction ?? noopAction, initialState)
  const [editing, setEditing] = useState<boolean>(false)

  const [playerMeta, setPlayerMeta] = useState<PlayerScore[]>(scores)
  const [scoreRowsById, setScoreRowsById] = useState<Record<string, { playerId: string; points: number | null }>>(() => {
    const map: Record<string, { playerId: string; points: number | null }> = {}
    for (const row of initialScoreRows ?? []) {
      map[row.id] = { playerId: row.player_id, points: row.points ?? 0 }
    }
    return map
  })

  // Subscribe to realtime score updates (single stream: realtime_events)
  useEffect(() => {
    const setupSubscription = async () => {
      try {
        const supabase = await getSupabase()

        const subscription = supabase
          .channel(`olympia-score-events-${matchId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'olympia',
              table: 'realtime_events',
              filter: `match_id=eq.${matchId}`,
            },
            (payload) => {
              const evt = (payload.new ?? null) as RealtimeEventRow | null
              if (!evt || evt.match_id !== matchId) return
              if (evt.entity !== 'match_scores') return

              const rowId = payloadString(evt.payload, 'id')
              const playerId = payloadString(evt.payload, 'playerId')
              const points = payloadNumber(evt.payload, 'points')
              if (!rowId || !playerId) return

              setScoreRowsById((prev) => {
                if (evt.event_type === 'DELETE') {
                  if (!prev[rowId]) return prev
                  const next = { ...prev }
                  delete next[rowId]
                  return next
                }
                return { ...prev, [rowId]: { playerId, points } }
              })
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(subscription)
        }
      } catch (error) {
        console.warn('[LiveScoreboard] Failed to setup realtime subscription:', error)
      }
    }

    void setupSubscription()
  }, [matchId])

  // Update local state when props change
  useEffect(() => {
    setPlayerMeta(scores)
  }, [scores])

  useEffect(() => {
    if (!initialScoreRows) return
    setScoreRowsById(() => {
      const map: Record<string, { playerId: string; points: number | null }> = {}
      for (const row of initialScoreRows) {
        map[row.id] = { playerId: row.player_id, points: row.points ?? 0 }
      }
      return map
    })
  }, [initialScoreRows])

  useEffect(() => {
    const message = resetState.error ?? resetState.success ?? editState.error ?? editState.success
    if (!message) return

    if (resetState.error || editState.error) toast.error(message)
    if (resetState.success || editState.success) toast.success(message)
  }, [editState, resetState])

  useEffect(() => {
    if (!pendingEdit && !pendingReset) {
      setEditing(false)
    }
  }, [pendingEdit, pendingReset])


  const derivedScores = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of Object.values(scoreRowsById)) {
      const prev = totals.get(row.playerId) ?? 0
      totals.set(row.playerId, prev + (row.points ?? 0))
    }

    return playerMeta.map((p) => ({
      ...p,
      totalScore: totals.get(p.playerId) ?? p.totalScore ?? 0,
    }))
  }, [playerMeta, scoreRowsById])

  const sortedScores = useMemo(
    () => [...derivedScores].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)),
    [derivedScores]
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editScoreAction ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing((v) => !v)}
                disabled={pendingEdit || pendingReset}
              >
                {editing ? 'Đóng chỉnh điểm' : 'Chỉnh sửa điểm'}
              </Button>
            ) : null}

            {resetScoresAction ? (
              <form action={resetFormAction} className="flex">
                <input type="hidden" name="matchId" value={matchId} />
                <Button type="submit" variant="outline" size="sm" disabled={pendingReset || pendingEdit}>
                  Reset điểm
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedScores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu điểm số</p>
        ) : (
          <div className="space-y-2">
            {editing && editScoreAction ? (
              <form action={editFormAction} className="space-y-2">
                <input type="hidden" name="matchId" value={matchId} />

                {sortedScores.map((player, index) => (
                  <div
                    key={player.playerId}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{player.displayName}</p>
                      {player.className && (
                        <p className="text-xs text-muted-foreground truncate">{player.className}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="font-mono">
                        {player.totalScore ?? 0}
                        {maxScore ? `/${maxScore}` : ''} điểm
                      </Badge>
                    </div>

                    <input type="hidden" name="playerId" value={player.playerId} />
                    <input
                      name="newTotal"
                      type="number"
                      defaultValue={player.totalScore ?? 0}
                      className="h-8 w-20 rounded-md border border-slate-200 bg-white px-2 text-sm"
                      aria-label={`Điểm mới cho ${player.displayName}`}
                    />
                  </div>
                ))}

                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={pendingEdit || pendingReset}>
                    Lưu
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                {sortedScores.map((player, index) => (
                  <div
                    key={player.playerId}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{player.displayName}</p>
                      {player.className && (
                        <p className="text-xs text-muted-foreground truncate">{player.className}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="font-mono">
                        {player.totalScore ?? 0}
                        {maxScore ? `/${maxScore}` : ''} điểm
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
