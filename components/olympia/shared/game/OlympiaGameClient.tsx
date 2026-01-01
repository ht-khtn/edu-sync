'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitAnswerAction, submitObstacleGuessAction, triggerBuzzerAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { useOlympiaGameState } from '@/components/olympia/shared/game/useOlympiaGameState'
import type { GameSessionPayload } from '@/types/olympia/game'

import { cn } from '@/utils/cn'

type OlympiaGameClientProps = {
  initialData: GameSessionPayload
  sessionId: string
  allowGuestFallback?: boolean
  viewerMode?: 'player' | 'guest' | 'mc'
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

export function OlympiaGameClient({ initialData, sessionId, allowGuestFallback, viewerMode }: OlympiaGameClientProps) {
  const {
    match,
    session,
    players,
    scores,
    roundQuestions,
    buzzerEvents,
    answers,
    starUses,
    obstacle,
    timerLabel,
    questionState,
    roundType,
    isRealtimeReady,
    viewerUserId,
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
  const isVeDich = roundType === 've_dich'
  const isKhoiDong = roundType === 'khoi_dong'
  const isStealWindow = isVeDich && questionState === 'answer_revealed'
  const questionStateText =
    isStealWindow ? 'Cửa sổ cướp' : (questionStateLabel[questionState] ?? questionState)
  const resolvedViewerMode: 'player' | 'guest' | 'mc' = viewerMode ?? (allowGuestFallback ? 'guest' : 'player')
  const isGuest = resolvedViewerMode === 'guest'
  const isMc = resolvedViewerMode === 'mc'
  const disableInteractions = isGuest || isMc
  const answerFeedback = answerState.error ?? answerState.success
  const cnvGuessFeedback = cnvGuessState.error ?? cnvGuessState.success
  const buzzerFeedback = buzzerState.error ?? buzzerState.success

  const formatPlayerLabel = (playerId: string | null | undefined) => {
    if (!playerId) return '—'
    const p = players.find((row) => row.id === playerId)
    if (!p) return playerId
    const seat = typeof p.seat_index === 'number' ? p.seat_index : '—'
    const name = p.display_name ?? 'Thí sinh'
    return `Ghế ${seat} · ${name}`
  }

  const currentQuestionId = session.current_round_question_id
  const currentRoundQuestion = currentQuestionId ? roundQuestions.find((q) => q.id === currentQuestionId) ?? null : null
  const questionRecord = currentRoundQuestion?.questions
    ? (Array.isArray(currentRoundQuestion.questions)
      ? currentRoundQuestion.questions[0] ?? null
      : currentRoundQuestion.questions)
    : null
  const questionText = currentRoundQuestion?.question_text ?? questionRecord?.question_text ?? null
  const answerText = currentRoundQuestion?.answer_text ?? questionRecord?.answer_text ?? null
  const noteText = currentRoundQuestion?.note ?? questionRecord?.note ?? null
  const showQuestionText = Boolean(questionText) && (isMc || questionState !== 'hidden')
  const targetPlayerId = currentRoundQuestion?.target_player_id ?? null
  const targetPlayer = targetPlayerId ? players.find((p) => p.id === targetPlayerId) ?? null : null
  const viewerPlayer = viewerUserId ? players.find((p) => p.participant_id === viewerUserId) ?? null : null
  const isViewerTarget = Boolean(viewerPlayer?.id && targetPlayerId && viewerPlayer.id === targetPlayerId)

  // ve_dich_value/star_uses vẫn được giữ trong state để dùng ở giai đoạn sau;
  // UI game hiện tại chưa hiển thị các badge này.

  const stealWinnerPlayerId =
    isStealWindow && currentQuestionId
      ? (buzzerEvents
        .filter((e) => e.round_question_id === currentQuestionId)
        .find((e) => (e.event_type ?? 'steal') === 'steal' && e.result === 'win')
        ?.player_id ?? null)
      : null
  const isViewerStealWinner = Boolean(viewerPlayer?.id && stealWinnerPlayerId && viewerPlayer.id === stealWinnerPlayerId)
  const stealWinnerLabel = stealWinnerPlayerId ? formatPlayerLabel(stealWinnerPlayerId) : null

  const canSubmitVeDich =
    !disableInteractions &&
    Boolean(
      viewerPlayer?.id &&
      currentQuestionId &&
      ((questionState === 'showing' && isViewerTarget) || (isStealWindow && isViewerStealWinner))
    )
  const disableAnswerSubmit = isVeDich ? !canSubmitVeDich : disableInteractions

  const canBuzzVeDich =
    !disableInteractions &&
    Boolean(
      viewerPlayer?.id &&
      isStealWindow &&
      !isViewerTarget &&
      !viewerPlayer?.is_disqualified_obstacle
    )
  const disableBuzz = isVeDich ? !canBuzzVeDich : disableInteractions

  void answers
  void starUses

  const viewerTotalScore = viewerPlayer?.id ? (scoreboard.find((s) => s.id === viewerPlayer.id)?.total ?? 0) : null
  void showQuestionText
  const isSessionRunning = session.status === 'running'
  const isWaitingScreen = !isMc && questionState === 'hidden'

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* HUD */}
      <header className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-950">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-slate-200">{questionTitle}</p>
          <p className="text-sm text-slate-100 truncate">{match.name}</p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={cn(
              'rounded-md px-3 py-1 font-mono text-base whitespace-nowrap border',
              session.timer_deadline ? 'border-emerald-500/60 text-emerald-100 bg-emerald-950/50' : 'border-slate-500/60 text-slate-100 bg-slate-900/50'
            )}
          >
            {timerLabel}
          </div>

          {viewerTotalScore != null ? (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-widest text-slate-200">Điểm</p>
              <p className="text-2xl font-semibold leading-none">{viewerTotalScore}</p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-widest text-slate-200">Realtime</p>
              <p className="text-sm font-medium">{isRealtimeReady ? 'ON' : '...'} </p>
            </div>
          )}
        </div>
      </header>

      {/* MAIN SCREEN */}
      <main className="flex-1 relative flex items-center justify-center px-6 py-10 bg-black">
        {!isSessionRunning ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
            <div className="text-center space-y-2">
              <p className="text-xs uppercase tracking-widest text-slate-200">Trạng thái</p>
              <p className="text-2xl font-semibold">Phòng chưa mở</p>
              <p className="text-sm text-slate-200">Hiện tại: {questionStateText}</p>
            </div>
          </div>
        ) : null}

        {isWaitingScreen ? (
          <div className="text-center space-y-3">
            <p className="text-xs uppercase tracking-widest text-slate-200">Màn chờ</p>
            <p className="text-4xl font-semibold">ĐANG CHỜ</p>
            <p className="text-sm text-slate-200">Host sẽ bật câu hỏi trong giây lát</p>
          </div>
        ) : (
          <div className="w-full max-w-5xl text-center">
            <p className="text-4xl sm:text-5xl font-semibold leading-snug whitespace-pre-wrap text-slate-50">
              {questionText?.trim() ? questionText : '—'}
            </p>

            {isMc && (answerText || noteText) ? (
              <div className="mt-6 text-left mx-auto max-w-3xl rounded-md border border-slate-700 bg-slate-950/60 p-4">
                {answerText ? (
                  <p className="text-sm whitespace-pre-wrap">
                    <span className="text-slate-200">Đáp án:</span> {answerText}
                  </p>
                ) : null}
                {noteText ? (
                  <p className="mt-2 text-sm whitespace-pre-wrap">
                    <span className="text-slate-200">Ghi chú:</span> {noteText}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {/* Top scoreboard mini */}
        {scoreboard.length > 0 ? (
          <div className="absolute top-4 left-4 rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs">
            <p className="text-[11px] uppercase tracking-widest text-slate-200">Bảng điểm</p>
            <div className="mt-1 space-y-1">
              {scoreboard.slice(0, 4).map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <span className="text-slate-100">
                    {idx + 1}. Ghế {p.seat ?? '—'}
                  </span>
                  <span className="font-mono text-white">{p.total}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Event feed mini */}
        <div className="absolute bottom-24 left-4 w-[240px] rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs">
          <p className="text-[11px] uppercase tracking-widest text-slate-200">Buzzer</p>
          {buzzerEvents.length === 0 ? (
            <p className="mt-1 text-slate-200">Chưa có tín hiệu</p>
          ) : (
            <div className="mt-1 space-y-1">
              {buzzerEvents.slice(0, 4).map((event) => {
                const ts = event.occurred_at ?? event.created_at
                const timestamp = ts ? new Date(ts).toLocaleTimeString('vi-VN') : '—'
                const eventType = event.event_type ?? 'buzz'
                const typeLabel = eventType === 'steal' ? 'CƯỚP' : eventType === 'buzz' ? 'BUZZ' : eventType
                return (
                  <div key={event.id ?? `${event.player_id}-${event.created_at}`} className="text-slate-100">
                    <span className="text-slate-200">[{typeLabel}]</span> {timestamp}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* INTERACTION BAR */}
      <footer className="px-4 py-4 border-t border-slate-700 bg-slate-950">
        {disableInteractions ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-200">
              {isMc
                ? 'Chế độ MC: chỉ quan sát (không gửi đáp án / bấm chuông).'
                : 'Chế độ khách: đăng nhập để gửi đáp án / bấm chuông.'}
            </p>
            <Button size="sm" variant="outline" onClick={refreshFromServer}>
              Làm mới
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-slate-200">Pha</p>
              <p className="text-sm text-slate-100">
                {isKhoiDong
                  ? targetPlayerId
                    ? `Khởi động · Thi riêng · ${targetPlayer ? `Ghế ${targetPlayer.seat_index ?? '—'}` : '—'}`
                    : 'Khởi động · Thi chung · Bấm chuông để giành quyền'
                  : isVeDich
                    ? isStealWindow
                      ? `Về đích · Cửa sổ cướp ${stealWinnerLabel ? `· Winner: ${stealWinnerLabel}` : ''}`
                      : 'Về đích'
                    : questionTitle}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              {(roundType !== 'khoi_dong') ? (
                <form action={answerAction} className="flex items-center gap-2">
                  <input type="hidden" name="sessionId" value={session.id} />
                  <Input
                    name="answer"
                    placeholder="Nhập đáp án"
                    disabled={disableAnswerSubmit}
                    className="w-[220px] bg-slate-900/70 border-slate-600 text-white placeholder:text-slate-300"
                  />
                  <FormSubmitButton disabled={disableAnswerSubmit}>Gửi</FormSubmitButton>
                </form>
              ) : null}

              {roundType === 'vcnv' && obstacle ? (
                <form action={cnvGuessAction} className="flex items-center gap-2">
                  <input type="hidden" name="sessionId" value={session.id} />
                  <Input
                    name="guessText"
                    placeholder="Đoán CNV"
                    disabled={disableInteractions}
                    className="w-[180px] bg-slate-900/70 border-slate-600 text-white placeholder:text-slate-300"
                  />
                  <FormSubmitButton disabled={disableInteractions} variant="outline">Đoán</FormSubmitButton>
                </form>
              ) : null}

              <form action={buzzerAction}>
                <input type="hidden" name="sessionId" value={session.id} />
                <Button
                  type="submit"
                  disabled={disableBuzz}
                  className="h-10 px-6"
                  variant={isKhoiDong && !targetPlayerId ? 'default' : 'outline'}
                >
                  Bấm chuông
                </Button>
              </form>

              <Button size="sm" variant="outline" onClick={refreshFromServer}>
                Làm mới
              </Button>
            </div>

            <div className="md:col-span-2 text-xs">
              {answerFeedback ? (
                <p className={cn(answerState.error ? 'text-red-300' : 'text-emerald-300')}>{answerFeedback}</p>
              ) : null}
              {cnvGuessFeedback ? (
                <p className={cn(cnvGuessState.error ? 'text-red-300' : 'text-emerald-300')}>{cnvGuessFeedback}</p>
              ) : null}
              {buzzerFeedback ? (
                <p className={cn(buzzerState.error ? 'text-red-300' : 'text-emerald-300')}>{buzzerFeedback}</p>
              ) : null}
            </div>
          </div>
        )}
      </footer>
    </div>
  )
}
