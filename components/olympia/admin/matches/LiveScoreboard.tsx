'use client'

import type { ReactNode } from 'react'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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
  maxScore,
  resetScoresAction,
  editScoreAction,
}: Props) {
  const [resetState, resetFormAction, pendingReset] = useActionState(resetScoresAction ?? noopAction, initialState)
  const [editState, editFormAction, pendingEdit] = useActionState(editScoreAction ?? noopAction, initialState)
  const lastToastRef = useRef<string | null>(null)
  const [editing, setEditing] = useState<boolean>(false)

  useEffect(() => {
    const message = resetState.error ?? resetState.success ?? editState.error ?? editState.success
    if (!message) return
    if (lastToastRef.current === message) return
    lastToastRef.current = message

    if (resetState.error || editState.error) toast.error(message)
    if (resetState.success || editState.success) toast.success(message)
  }, [editState.error, editState.success, resetState.error, resetState.success])

  const sortedScores = useMemo(
    () => [...scores].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)),
    [scores]
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

                {editing && editScoreAction ? (
                  <form action={editFormAction} className="flex items-center gap-2">
                    <input type="hidden" name="matchId" value={matchId} />
                    <input type="hidden" name="playerId" value={player.playerId} />
                    <input
                      name="newTotal"
                      type="number"
                      defaultValue={player.totalScore ?? 0}
                      className="h-8 w-20 rounded-md border border-slate-200 bg-white px-2 text-sm"
                      aria-label={`Điểm mới cho ${player.displayName}`}
                    />
                    <Button type="submit" size="sm" disabled={pendingEdit || pendingReset}>
                      Lưu
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
