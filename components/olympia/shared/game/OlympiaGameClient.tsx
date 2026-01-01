'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { submitAnswerAction, submitObstacleGuessAction, triggerBuzzerAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { useOlympiaGameState } from '@/components/olympia/shared/game/useOlympiaGameState'
import type { GameSessionPayload } from '@/types/olympia/game'

import { cn } from '@/utils/cn'

type OlympiaGameClientProps = {
  initialData: GameSessionPayload
  sessionId: string
  allowGuestFallback?: boolean
}

const roundLabel: Record<string, string> = {
  khoi_dong: 'Khởi động',
  vcnv: 'Vượt chướng ngại vật',
  tang_toc: 'Tăng tốc',
  ve_dich: 'Về đích',
  unknown: 'Đang xác định',
}

const questionStateLabel: Record<string, string> = {
  hidden: 'Đang ẩn',
  showing: 'Đang hiển thị',
  answer_revealed: 'Đã mở đáp án',
  completed: 'Đã chấm',
}

const actionInitialState: ActionState = { error: null, success: null }

function FormSubmitButton({ children, disabled, variant }: { children: ReactNode; disabled?: boolean; variant?: 'default' | 'outline' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="flex-1" variant={variant ?? 'default'} disabled={disabled || pending}>
      {pending ? 'Đang gửi…' : children}
    </Button>
  )
}

export function OlympiaGameClient({ initialData, sessionId, allowGuestFallback }: OlympiaGameClientProps) {
  const {
    match,
    session,
    players,
    scores,
    buzzerEvents,
    obstacle,
    obstacleTiles,
    obstacleGuesses,
    timerLabel,
    questionState,
    roundType,
    statusMessage,
    isRealtimeReady,
    refreshFromServer,
  } = useOlympiaGameState({ sessionId, initialData })
  const [answerState, answerAction] = useActionState(submitAnswerAction, actionInitialState)
  const [cnvGuessState, cnvGuessAction] = useActionState(submitObstacleGuessAction, actionInitialState)
  const [buzzerState, buzzerAction] = useActionState(triggerBuzzerAction, actionInitialState)

  const scoreboard = useMemo(() => {
    const totals = new Map<string, number>()
    for (const score of scores) {
      if (!score.player_id) continue
      const prev = totals.get(score.player_id) ?? 0
      const current = typeof score.points === 'number' ? score.points : 0
      totals.set(score.player_id, prev + current)
    }

    return players
      .map((player) => {
        const id = player.id
        return {
          id,
          name: player.display_name ?? 'Thí sinh',
          seat: player.seat_index,
          total: totals.get(id) ?? 0,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [players, scores])

  const questionTitle = roundLabel[roundType] ?? roundType
  const questionStateText = questionStateLabel[questionState] ?? questionState
  const isGuest = Boolean(allowGuestFallback)
  const disableInteractions = isGuest
  const answerFeedback = answerState.error ?? answerState.success
  const cnvGuessFeedback = cnvGuessState.error ?? cnvGuessState.success
  const buzzerFeedback = buzzerState.error ?? buzzerState.success

  return (
    <div className="grid gap-4 lg:gap-6 lg:grid-cols-4 auto-rows-max lg:auto-rows-auto">
      <div className="lg:col-span-3 space-y-4 lg:space-y-6">
        <Card className="overflow-hidden border border-slate-200">
          <CardHeader className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6">
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl truncate">{questionTitle}</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Trận: {match.name}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <Badge variant="outline" className="text-xs">{questionStateText}</Badge>
              <div className={cn('rounded-md border px-2 sm:px-3 py-1 font-mono text-sm sm:text-lg whitespace-nowrap', session.timer_deadline ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                {timerLabel}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {roundType === 'vcnv' && obstacle ? (
              <div className="rounded-xl border bg-white p-4 space-y-3">
                <p className="text-xs font-semibold uppercase text-slate-500">CNV · Chướng ngại vật</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Tiêu đề:</span> {obstacle.title ?? '—'}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {(obstacleTiles ?? []).length > 0 ? (
                    obstacleTiles
                      .slice()
                      .sort((a, b) => a.position_index - b.position_index)
                      .map((t) => (
                        <div
                          key={t.id}
                          className={cn(
                            'rounded-md border px-2 py-3 text-center text-xs font-mono',
                            t.is_open ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                          )}
                        >
                          {t.position_index}
                          <div className="text-[10px] mt-1">{t.is_open ? 'MỞ' : 'ĐÓNG'}</div>
                        </div>
                      ))
                  ) : (
                    <p className="col-span-5 text-sm text-muted-foreground">Chưa có dữ liệu ô CNV.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Lượt đoán gần đây</p>
                  {(obstacleGuesses ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có lượt đoán.</p>
                  ) : (
                    <div className="space-y-2">
                      {obstacleGuesses.slice(0, 5).map((g) => (
                        <div key={g.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                          <p className="font-semibold">{g.player_id}</p>
                          <p className="text-muted-foreground">
                            {g.attempted_at ? new Date(g.attempted_at).toLocaleTimeString('vi-VN') : '—'} · {g.is_correct ? 'ĐÚNG' : 'CHƯA/SAI'}
                          </p>
                          <p className="mt-1">{g.guess_text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-3">
                <div className="aspect-video w-full overflow-hidden rounded-xl border bg-slate-900/90 text-xs text-white">
                  <div className="flex h-full items-center justify-center text-center">
                    {/* TODO: render question media (image/video) once asset pipeline is ready. */}
                    <p className="px-6 text-sm text-slate-200">Đang chờ host hiển thị câu hỏi...</p>
                  </div>
                </div>
                <div className="rounded-xl border bg-slate-50 p-4 text-sm leading-relaxed">
                  {/* TODO: render host video feed or livestream embed. */}
                  <p className="text-muted-foreground">
                    Nội dung câu hỏi sẽ hiển thị ở đây khi host chuyển trạng thái sang “Đang hiển thị”. Các hiệu ứng hình ảnh sẽ được bổ sung
                    sau.
                  </p>
                </div>
              </div>
              {!isGuest ? (
                <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase text-slate-500">Bài làm</p>
                  <form action={answerAction} className="space-y-3">
                    <input type="hidden" name="sessionId" value={session.id} />
                    <Textarea
                      name="notes"
                      placeholder="Nhập ghi chú hoặc lập luận"
                      rows={6}
                      disabled={disableInteractions}
                      className="resize-none"
                    />
                    <Input name="answer" placeholder="Đáp án cuối cùng" disabled={disableInteractions} />
                    <div className="flex gap-3">
                      <FormSubmitButton disabled={disableInteractions}>Gửi đáp án</FormSubmitButton>
                    </div>
                    {answerFeedback ? (
                      <p className={cn('text-xs', answerState.error ? 'text-destructive' : 'text-emerald-600')}>
                        {answerFeedback}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {/* TODO: route data vào scoring service thay vì chỉ log (stub). */}
                      Hệ thống tạm thời ghi log server-side cho mỗi đáp án để QA trước khi bật tính điểm.
                    </p>
                  </form>

                  {roundType === 'vcnv' && obstacle ? (
                    <>
                      <Separator />
                      <form action={cnvGuessAction} className="space-y-2">
                        <input type="hidden" name="sessionId" value={session.id} />
                        <p className="text-xs font-semibold uppercase text-slate-500">CNV · Dự đoán chướng ngại vật</p>
                        <Input name="guessText" placeholder="Nhập dự đoán CNV" disabled={disableInteractions} />
                        <div className="flex gap-3">
                          <FormSubmitButton disabled={disableInteractions}>Gửi dự đoán</FormSubmitButton>
                        </div>
                        {cnvGuessFeedback ? (
                          <p className={cn('text-xs', cnvGuessState.error ? 'text-destructive' : 'text-emerald-600')}>
                            {cnvGuessFeedback}
                          </p>
                        ) : null}
                      </form>
                    </>
                  ) : null}

                  <Separator />

                  <form action={buzzerAction} className="space-y-2">
                    <input type="hidden" name="sessionId" value={session.id} />
                    <FormSubmitButton variant="outline" disabled={disableInteractions}>
                      Bấm chuông
                    </FormSubmitButton>
                    {buzzerFeedback ? (
                      <p className={cn('text-xs', buzzerState.error ? 'text-destructive' : 'text-emerald-600')}>
                        {buzzerFeedback}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      {/* TODO: dispatch triggerBuzzerAction tới realtime channel + lock seat. */}
                      Chức năng hiện ghi nhận yêu cầu và sẽ được đồng bộ với host console trong bản kế tiếp.
                    </p>
                  </form>

                  {isGuest ? (
                    <Alert>
                      <AlertDescription>Bạn cần đăng nhập để gửi đáp án hoặc bấm chuông.</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase text-slate-500">Chế độ khách</p>
                  <p className="text-sm text-muted-foreground">
                    Bạn đang xem màn hình công khai. Thí sinh vui lòng vào link game và đăng nhập để bấm chuông / gửi đáp án.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <Card className="border border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bảng điểm tạm thời</CardTitle>
            <p className="text-xs text-muted-foreground">Tự động cập nhật từ server.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-2">
              {scoreboard.length === 0 ? (
                <p className="text-xs text-muted-foreground">Chưa có dữ liệu điểm.</p>
              ) : (
                scoreboard.map((player, index) => (
                  <div key={player.id} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {index + 1}. {player.name}
                      </p>
                      <p className="text-xs text-muted-foreground">Ghế {player.seat ?? '—'}</p>
                    </div>
                    <span className="text-lg font-semibold text-slate-900">{player.total}</span>
                  </div>
                ))
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {/* TODO: custom styling / animation for podium + delta once scoring rules hoàn thiện. */}
              Giao diện bảng điểm sẽ được tinh chỉnh thêm hiệu ứng podium trong giai đoạn kế tiếp.
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dòng sự kiện / Buzzer</CardTitle>
            <p className="text-xs text-muted-foreground">Lưu 20 lần tương tác gần nhất.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {buzzerEvents.length === 0 ? (
              <p className="text-muted-foreground">Chưa có tín hiệu buzzer.</p>
            ) : (
              buzzerEvents.map((event) => {
                const ts = event.occurred_at ?? event.created_at
                const timestamp = ts ? new Date(ts).toLocaleTimeString('vi-VN') : '—'
                return (
                  <div
                    key={event.id ?? `${event.player_id}-${event.created_at}`}
                    className="rounded-md border border-slate-100 bg-white px-3 py-2 shadow-sm"
                  >
                    <p className="font-semibold">{event.player_id ?? '—'}</p>
                    <p className="text-muted-foreground">
                      {timestamp} · {event.event_type ?? 'event'} {event.result ? `· ${event.result}` : ''}
                    </p>
                  </div>
                )
              })
            )}
            <p className="text-[11px] text-muted-foreground">
              {/* TODO: add richer event badges + animation when buzzer services ready. */}
              Dòng sự kiện sẽ hiển thị rõ tên thí sinh và kết quả xử lý khi module buzzer hoàn tất.
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trạng thái kết nối</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Realtime</span>
              <Badge variant={isRealtimeReady ? 'default' : 'secondary'}>{isRealtimeReady ? 'Đã kết nối' : 'Đang đợi…'}</Badge>
            </div>
            {statusMessage ? <p>{statusMessage}</p> : <p>Đang nghe điều khiển từ host.</p>}
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={refreshFromServer}>
              Làm mới trạng thái
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
