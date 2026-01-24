'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Clock, Users, Radio, Zap } from 'lucide-react'
import type { LiveSessionRow, MatchRow } from '@/types/olympia/game'

type SessionInfoSidebarProps = {
  session: LiveSessionRow
  match: MatchRow
  playerCount?: number
  timerLabel?: string
  variant?: 'default' | 'mc'
}

const roundLabelMap: Record<string, string> = {
  khoi_dong: 'Khởi động',
  vcnv: 'Vượt chướng ngại vật',
  tang_toc: 'Tăng tốc',
  ve_dich: 'Về đích',
}

const questionStateLabel: Record<string, string> = {
  hidden: 'Ẩn',
  showing: 'Hiển thị',
  answer_revealed: 'Đáp án',
  completed: 'Hoàn tất',
}

export function SessionInfoSidebar({ session, match, playerCount = 0, timerLabel, variant = 'default' }: SessionInfoSidebarProps) {
  const isSessionRunning = session.status === 'running'

  return (
    <div className="space-y-3">
      <Card className={isSessionRunning ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>Phòng thi</span>
            <Badge variant={isSessionRunning ? 'default' : 'secondary'} className="gap-1">
              <Radio className="h-3 w-3" />
              {isSessionRunning ? 'Mở' : 'Chờ'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mã tham gia:</span>
            <span className="font-mono font-bold text-sm">{session.join_code}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Trận:</span>
            <span className="font-semibold">{match.name}</span>
          </div>

          {timerLabel && (
            <div className="flex items-center justify-between rounded-md bg-white/50 p-2">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Đồng hồ:</span>
              </div>
              <span className="font-mono font-bold">{timerLabel}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {variant !== 'mc' && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Tình trạng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vòng hiện tại:</span>
                <span className="font-semibold">
                  {session.current_round_type ? roundLabelMap[session.current_round_type] : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trạng thái câu:</span>
                <Badge variant="outline" className="text-xs">
                  {session.question_state ? questionStateLabel[session.question_state] : '—'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Thí sinh
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-center">{playerCount}</p>
              <p className="text-xs text-muted-foreground text-center">đang tham gia</p>
            </CardContent>
          </Card>
        </>
      )}

      {!isSessionRunning && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-xs">
            Phòng chưa mở. Hãy chờ host khởi động trận thi.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
