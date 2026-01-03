'use client'

import type { ReactNode } from 'react'
import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type ActionState = {
  error?: string | null
  success?: string | null
  data?: Record<string, unknown> | null
}

type ResetScoresAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>

const initialState: ActionState = { error: null, success: null }
const noopAction: ResetScoresAction = async (prevState) => prevState

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
  showRoundBreakdown?: boolean
  maxScore?: number
  resetScoresAction?: ResetScoresAction
}

export function LiveScoreboard({
  matchId,
  title = 'Bảng xếp hạng',
  description = 'Điểm số các thí sinh trong trận thi',
  scores,
  maxScore,
  resetScoresAction,
}: Props) {
  const [state, formAction, pending] = useActionState(resetScoresAction ?? noopAction, initialState)
  const lastToastRef = useRef<string | null>(null)

  useEffect(() => {
    const message = state.error ?? state.success
    if (!message) return
    if (lastToastRef.current === message) return
    lastToastRef.current = message

    if (state.error) toast.error(message)
    if (state.success) toast.success(message)
  }, [state.error, state.success])

  const sortedScores = [...scores].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>

          {resetScoresAction ? (
            <form action={formAction} className="flex">
              <input type="hidden" name="matchId" value={matchId} />
              <Button type="submit" variant="outline" size="sm" disabled={pending}>
                Reset điểm
              </Button>
            </form>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {sortedScores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu điểm số</p>
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
      </CardContent>
    </Card>
  )
}
