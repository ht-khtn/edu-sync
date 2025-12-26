'use client'

import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
}

export function LiveScoreboard({
  title = 'Bảng xếp hạng',
  description = 'Điểm số các thí sinh trong trận thi',
  scores,
  maxScore,
}: Props) {
  const sortedScores = [...scores].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
