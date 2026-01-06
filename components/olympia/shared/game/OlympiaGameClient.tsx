'use client'

import type { ReactNode, CSSProperties } from 'react'
import { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus, createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitAnswerAction, triggerBuzzerAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { useOlympiaGameState } from '@/components/olympia/shared/game/useOlympiaGameState'
import type { GameSessionPayload } from '@/types/olympia/game'
import { RefreshCw, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { OlympiaQuestionsPreloadOverlay } from '@/components/olympia/shared/game/OlympiaQuestionsPreloadOverlay'

import { cn } from '@/utils/cn'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

type OlympiaGameClientProps = {
  initialData: GameSessionPayload
  sessionId: string
  allowGuestFallback?: boolean
  viewerMode?: 'player' | 'guest' | 'mc'
  mcScoreboardSlotId?: string
  mcBuzzerSlotId?: string
}

type BuzzerEventLite = {
  id: string | null
  round_question_id: string | null
  player_id: string | null
  event_type: string | null
  result: string | null
  occurred_at: string | null
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

export function OlympiaGameClient({
  initialData,
  sessionId,
  allowGuestFallback,
  viewerMode,
  mcScoreboardSlotId,
  mcBuzzerSlotId,
}: OlympiaGameClientProps) {
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
    obstacleTiles,
    timerLabel,
    questionState,
    roundType,
    isRealtimeReady,
    viewerUserId,
    refreshFromServer,
  } = useOlympiaGameState({ sessionId, initialData })
  const [answerState, answerAction] = useActionState(submitAnswerAction, actionInitialState)
  const [buzzerState, buzzerAction] = useActionState(triggerBuzzerAction, actionInitialState)

  const [optimisticBuzzerWinner, setOptimisticBuzzerWinner] = useState<{
    roundQuestionId: string
    playerId: string
    eventType: 'buzz' | 'steal'
  } | null>(null)

  // Blocking preload overlay (không có nút huỷ)
  // Ưu tiên preload từ initialData để chạy ngay khi mount.
  const preloadRoundQuestions = useMemo(() => initialData.roundQuestions ?? [], [initialData.roundQuestions])

  // Toast notifications for feedback
  useEffect(() => {
    const answerFeedback = answerState.error ?? answerState.success
    if (answerFeedback) {
      if (answerState.error) {
        toast.error(answerFeedback)
      } else {
        toast.success(answerFeedback)
      }
    }
  }, [answerState.error, answerState.success])

  useEffect(() => {
    const buzzerFeedback = buzzerState.error ?? buzzerState.success
    if (buzzerFeedback) {
      if (buzzerState.error) {
        toast.error(buzzerFeedback)
      } else {
        toast.success(buzzerFeedback)
      }
    }
  }, [buzzerState.error, buzzerState.success])

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

  const resolvedMcScoreboardSlotId = mcScoreboardSlotId ?? 'olympia-mc-scoreboard-slot'
  const [mcScoreboardSlotEl, setMcScoreboardSlotEl] = useState<HTMLElement | null>(null)
  const resolvedMcBuzzerSlotId = mcBuzzerSlotId ?? 'olympia-mc-buzzer-slot'
  const [mcBuzzerSlotEl, setMcBuzzerSlotEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!isMc) {
      setMcScoreboardSlotEl(null)
      setMcBuzzerSlotEl(null)
      return
    }
    if (typeof document === 'undefined') return
    setMcScoreboardSlotEl(document.getElementById(resolvedMcScoreboardSlotId))
    setMcBuzzerSlotEl(document.getElementById(resolvedMcBuzzerSlotId))
  }, [isMc, resolvedMcBuzzerSlotId, resolvedMcScoreboardSlotId])

  const guestAudioRef = useRef<HTMLAudioElement | null>(null)
  const syncedVideoRef = useRef<HTMLVideoElement | null>(null)
  const lastMediaCmdRef = useRef<{ audio: number; video: number }>({ audio: 0, video: 0 })

  const showBigScoreboard = session.show_scoreboard_overlay === true
  const lastFastestBuzzerRef = useRef<{ roundQuestionId: string | null; key: string | null }>({
    roundQuestionId: null,
    key: null,
  })

  const formatPlayerLabel = useCallback((playerId: string | null | undefined) => {
    if (!playerId) return '—'
    const p = players.find((row) => row.id === playerId)
    if (!p) return playerId
    const seat = typeof p.seat_index === 'number' ? p.seat_index : '—'
    const name = p.display_name ?? 'Thí sinh'
    return `Ghế ${seat} · ${name}`
  }, [players])

  const currentQuestionId = session.current_round_question_id
  const currentQuestionBuzzerEvents = useMemo((): BuzzerEventLite[] => {
    if (!currentQuestionId) return []

    const all = (buzzerEvents as unknown as BuzzerEventLite[]).filter(
      (e) => (e.round_question_id ?? null) === currentQuestionId
    )
    if (all.length === 0) return []

    const resetTs = all
      .filter((e) => (e.event_type ?? null) === 'reset' && e.occurred_at)
      .map((e) => Date.parse(e.occurred_at ?? ''))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0]

    const effective = Number.isFinite(resetTs)
      ? all.filter((e) => {
        const ts = e.occurred_at ? Date.parse(e.occurred_at) : NaN
        return Number.isFinite(ts) && ts >= (resetTs as number)
      })
      : all

    return effective.filter((e) => (e.event_type ?? null) !== 'reset')
  }, [buzzerEvents, currentQuestionId])
  const currentRoundQuestion = currentQuestionId ? roundQuestions.find((q) => q.id === currentQuestionId) ?? null : null
  const questionRecord = currentRoundQuestion?.questions
    ? (Array.isArray(currentRoundQuestion.questions)
      ? currentRoundQuestion.questions[0] ?? null
      : currentRoundQuestion.questions)
    : null
  const questionSetItemRecord = currentRoundQuestion?.question_set_items
    ? (Array.isArray(currentRoundQuestion.question_set_items)
      ? currentRoundQuestion.question_set_items[0] ?? null
      : currentRoundQuestion.question_set_items)
    : null
  const questionText = currentRoundQuestion?.question_text ?? questionRecord?.question_text ?? null
  const answerText = currentRoundQuestion?.answer_text ?? questionRecord?.answer_text ?? null
  const noteText = currentRoundQuestion?.note ?? questionRecord?.note ?? null
  const mediaUrl = (questionSetItemRecord?.image_url ?? questionRecord?.image_url ?? null)?.trim() || null
  const audioUrl = (questionSetItemRecord?.audio_url ?? questionRecord?.audio_url ?? null)?.trim() || null

  const metaQuestionCode = useMemo(() => {
    const meta = currentRoundQuestion?.meta
    if (!meta || typeof meta !== 'object') return null
    const rec = meta as Record<string, unknown>
    const raw = rec.code
    const trimmed = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
    return trimmed || null
  }, [currentRoundQuestion?.meta])

  const questionCode = useMemo(() => {
    const raw = (metaQuestionCode ?? questionSetItemRecord?.code ?? questionRecord?.code ?? null)
    const trimmed = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
    return trimmed || null
  }, [metaQuestionCode, questionRecord?.code, questionSetItemRecord?.code])

  // Chỉ hiển thị UI chướng ngại vật khi câu hiện tại là CNV (không áp dụng cho VCNV-1..4/OTT).
  const isCnvQuestion = useMemo(() => {
    if (!questionCode) return false
    return questionCode.startsWith('CNV') && !questionCode.startsWith('VCNV')
  }, [questionCode])

  const shouldUseObstacleUi = roundType === 'vcnv' && isCnvQuestion

  const showQuestionText = Boolean(questionText) && (isMc || questionState !== 'hidden') && !shouldUseObstacleUi
  const showQuestionMedia = Boolean(mediaUrl) && (isMc || questionState !== 'hidden') && !shouldUseObstacleUi
  const targetPlayerId = currentRoundQuestion?.target_player_id ?? null
  const targetPlayer = targetPlayerId ? players.find((p) => p.id === targetPlayerId) ?? null : null
  const viewerPlayer = viewerUserId ? players.find((p) => p.participant_id === viewerUserId) ?? null : null
  const isViewerTarget = Boolean(viewerPlayer?.id && targetPlayerId && viewerPlayer.id === targetPlayerId)
  const isViewerDisqualifiedObstacle = roundType === 'vcnv' && viewerPlayer?.is_disqualified_obstacle === true

  // ve_dich_value/star_uses vẫn được giữ trong state để dùng ở giai đoạn sau;
  // UI game hiện tại chưa hiển thị các badge này.

  const stealWinnerPlayerId =
    isStealWindow && currentQuestionId
      ? (currentQuestionBuzzerEvents
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

  // Quy tắc chung: ngoài VCNV, nếu đã có target_player_id thì chỉ target mới được gửi.
  // (target có thể là lượt cá nhân hoặc người bấm chuông thắng).
  const isLockedToTarget = roundType !== 'vcnv' && Boolean(targetPlayerId)
  const canSubmitGeneric = !disableInteractions && (!isLockedToTarget || Boolean(isViewerTarget)) && !isViewerDisqualifiedObstacle
  const disableAnswerSubmit = isVeDich ? !canSubmitVeDich : !canSubmitGeneric

  const canBuzzVeDich =
    !disableInteractions &&
    Boolean(
      viewerPlayer?.id &&
      isStealWindow &&
      !isViewerTarget
    )
  const disableBuzz = (session.buzzer_enabled === false) || (isVeDich ? !canBuzzVeDich : disableInteractions) || isViewerDisqualifiedObstacle

  const isSessionRunning = session.status === 'running'
  const isWaitingScreen = !isMc && questionState === 'hidden'
  const isOnline = useOnlineStatus()

  const viewerSeatNameText = useMemo(() => {
    if (resolvedViewerMode !== 'player') return null
    if (!viewerPlayer) return null
    const seat = typeof viewerPlayer.seat_index === 'number' ? viewerPlayer.seat_index : null
    const name = viewerPlayer.display_name ?? 'Thí sinh'
    return seat != null ? `Ghế ${seat} · ${name}` : name
  }, [resolvedViewerMode, viewerPlayer])

  const turnStatusText = useMemo(() => {
    if (resolvedViewerMode !== 'player') return null
    if (isWaitingScreen) return null
    if (!currentQuestionId) return 'Chưa có câu hỏi'

    // Ưu tiên hiển thị trạng thái buzzer (nếu có người thắng) để đúng trường hợp cướp chuông.
    const winnerBuzzId =
      currentQuestionBuzzerEvents
        .find((e) => (e.event_type ?? 'buzz') === (isStealWindow ? 'steal' : 'buzz') && e.result === 'win')
        ?.player_id ?? null

    const optimisticWinnerId =
      optimisticBuzzerWinner &&
        optimisticBuzzerWinner.roundQuestionId === currentQuestionId &&
        optimisticBuzzerWinner.eventType === (isStealWindow ? 'steal' : 'buzz')
        ? optimisticBuzzerWinner.playerId
        : null

    const effectiveWinnerId = winnerBuzzId ?? optimisticWinnerId

    if (effectiveWinnerId) {
      return roundType === 'vcnv'
        ? `Đã bấm chuông: ${formatPlayerLabel(effectiveWinnerId)}`
        : `Đang trả lời: ${formatPlayerLabel(effectiveWinnerId)}`
    }
    if (session.buzzer_enabled !== false && (questionState === 'showing' || isStealWindow)) {
      return 'Chưa ai bấm chuông'
    }
    // Tránh duplicate hiển thị lượt: lượt đã được gắn ở header (cạnh tên vòng).
    if (targetPlayerId) return null
    return '—'
  }, [currentQuestionBuzzerEvents, currentQuestionId, formatPlayerLabel, isStealWindow, isWaitingScreen, optimisticBuzzerWinner, questionState, resolvedViewerMode, roundType, session.buzzer_enabled, targetPlayerId])

  void answers
  void starUses
  void isKhoiDong
  void targetPlayer
  void stealWinnerLabel

  const viewerTotalScore = viewerPlayer?.id ? (scoreboard.find((s) => s.id === viewerPlayer.id)?.total ?? 0) : null
  void showQuestionText
  const playerTurnSuffix =
    resolvedViewerMode === 'player' && !isWaitingScreen && targetPlayerId
      ? ` · Luợt: ${formatPlayerLabel(targetPlayerId)}`
      : ''

  const playerBuzzerLabel = useMemo(() => {
    if (resolvedViewerMode !== 'player') return null
    if (!currentQuestionId) return '—'

    const winnerBuzzId =
      currentQuestionBuzzerEvents
        .find((e) => (e.event_type ?? 'buzz') === (isStealWindow ? 'steal' : 'buzz') && e.result === 'win')
        ?.player_id ?? null

    const optimisticWinnerId =
      optimisticBuzzerWinner &&
        optimisticBuzzerWinner.roundQuestionId === currentQuestionId &&
        optimisticBuzzerWinner.eventType === (isStealWindow ? 'steal' : 'buzz')
        ? optimisticBuzzerWinner.playerId
        : null

    const effectiveWinnerId = winnerBuzzId ?? optimisticWinnerId

    if (effectiveWinnerId) return `Đã bấm chuông: ${formatPlayerLabel(effectiveWinnerId)}`
    if (session.buzzer_enabled === false) return 'Đang tắt'
    if (questionState === 'showing' || isStealWindow) return 'Chưa ai bấm chuông'
    return '—'
  }, [currentQuestionBuzzerEvents, currentQuestionId, formatPlayerLabel, isStealWindow, optimisticBuzzerWinner, questionState, resolvedViewerMode, session.buzzer_enabled])

  const mcTurnLabel = useMemo(() => {
    if (!isMc) return null
    if (!currentQuestionId) return 'Chưa có câu hỏi'
    return targetPlayerId ? formatPlayerLabel(targetPlayerId) : '—'
  }, [currentQuestionId, formatPlayerLabel, isMc, targetPlayerId])

  const mcBuzzerLabel = useMemo(() => {
    if (!isMc) return null
    if (!currentQuestionId) return '—'

    const winnerBuzzId =
      currentQuestionBuzzerEvents
        .find((e) => (e.event_type ?? 'buzz') === (isStealWindow ? 'steal' : 'buzz') && e.result === 'win')
        ?.player_id ?? null

    if (winnerBuzzId) return `Đã bấm chuông: ${formatPlayerLabel(winnerBuzzId)}`
    if (session.buzzer_enabled === false) return 'Đang tắt'
    if (questionState === 'showing' || isStealWindow) return 'Chưa ai bấm chuông'
    return '—'
  }, [currentQuestionBuzzerEvents, currentQuestionId, formatPlayerLabel, isMc, isStealWindow, questionState, session.buzzer_enabled])

  // Optimistic UI: thí sinh bấm chuông thắng -> status đổi ngay, không chờ realtime/poll.
  useEffect(() => {
    const msg = (buzzerState.success ?? '').trim()
    if (!msg) return
    if (resolvedViewerMode !== 'player') return
    if (!viewerPlayer?.id) return
    if (!currentQuestionId) return

    const lower = msg.toLowerCase()
    const isLose = lower.includes('không phải người nhanh nhất')
    const isWin = lower.includes('giành quyền') || lower.includes('bấm nhanh nhất') || lower.includes('xin đoán cnv')
    if (!isWin || isLose) return

    setOptimisticBuzzerWinner({
      roundQuestionId: currentQuestionId,
      playerId: viewerPlayer.id,
      eventType: isStealWindow ? 'steal' : 'buzz',
    })
  }, [buzzerState.success, currentQuestionId, isStealWindow, resolvedViewerMode, viewerPlayer?.id])

  useEffect(() => {
    // Đổi câu thì reset optimistic winner.
    setOptimisticBuzzerWinner((prev) => {
      if (!prev) return null
      if (prev.roundQuestionId !== currentQuestionId) return null
      return prev
    })
  }, [currentQuestionId])

  useEffect(() => {
    // Nếu server đã reset (buzzer events rỗng sau reset) thì bỏ optimistic.
    if (!currentQuestionId) return
    if (!optimisticBuzzerWinner) return
    if (optimisticBuzzerWinner.roundQuestionId !== currentQuestionId) return
    if (currentQuestionBuzzerEvents.length === 0) {
      setOptimisticBuzzerWinner(null)
    }
  }, [currentQuestionBuzzerEvents.length, currentQuestionId, optimisticBuzzerWinner])

  const mediaKind = useMemo(() => {
    if (!mediaUrl) return null
    const lower = mediaUrl.toLowerCase()
    const isYouTube = lower.includes('youtube.com') || lower.includes('youtu.be')
    if (isYouTube) return 'youtube'
    const isVideo = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(lower)
    if (isVideo) return 'video'
    const isImage = /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/.test(lower)
    if (isImage) return 'image'
    // Fallback: cột này có thể là link Ảnh/Video nhưng không có extension
    return 'link'
  }, [mediaUrl])

  const youtubeEmbedUrl = useMemo(() => {
    if (!mediaUrl || mediaKind !== 'youtube') return null
    try {
      const url = new URL(mediaUrl)
      if (url.hostname.includes('youtu.be')) {
        const id = url.pathname.replace('/', '').trim()
        return id ? `https://www.youtube.com/embed/${id}` : null
      }
      const v = url.searchParams.get('v')
      return v ? `https://www.youtube.com/embed/${v}` : null
    } catch {
      return null
    }
  }, [mediaKind, mediaUrl])

  useEffect(() => {
    const canReceiveVideoControl = isGuest || resolvedViewerMode === 'player'
    const canReceiveAudioControl = isGuest
    if (!canReceiveVideoControl && !canReceiveAudioControl) return
    const control = session.guest_media_control
    if (!control) return

    const applyCommand = async (mediaType: 'audio' | 'video') => {
      if (mediaType === 'audio' && !canReceiveAudioControl) return
      if (mediaType === 'video' && !canReceiveVideoControl) return

      const cmd = control[mediaType]
      if (!cmd) return
      const cmdId = typeof cmd.commandId === 'number' ? cmd.commandId : 0
      if (cmdId <= lastMediaCmdRef.current[mediaType]) return
      const action = cmd.action
      const element = mediaType === 'audio' ? guestAudioRef.current : syncedVideoRef.current

      // Nếu media element chưa mount xong, để effect chạy lại khi UI render xong.
      if (!element) {
        console.info('[Olympia][GuestMedia] element not mounted yet', {
          mediaType,
          action,
          cmdId,
          isWaitingScreen,
          resolvedViewerMode,
        })
        return
      }

      console.info('[Olympia][GuestMedia] received command', {
        mediaType,
        action,
        cmdId,
        readyState: element.readyState,
        paused: element.paused,
        currentTime: Number.isFinite(element.currentTime) ? element.currentTime : null,
        muted: element.muted,
        isWaitingScreen,
        resolvedViewerMode,
      })

      lastMediaCmdRef.current = { ...lastMediaCmdRef.current, [mediaType]: cmdId }

      const waitForCanPlay = async (el: HTMLMediaElement) => {
        if (el.readyState >= 2) return

        await new Promise<void>((resolve) => {
          let done = false
          const finish = () => {
            if (done) return
            done = true
            el.removeEventListener('canplay', finish)
            el.removeEventListener('loadeddata', finish)
            resolve()
          }

          el.addEventListener('canplay', finish)
          el.addEventListener('loadeddata', finish)
          window.setTimeout(finish, 1200)
        })
      }

      const tryPlay = async (el: HTMLMediaElement, opts?: { restart?: boolean }) => {
        try {
          // Một số trình duyệt cần load trước khi play (đặc biệt khi src mới set).
          if (el.readyState === 0) {
            try {
              el.load()
            } catch {
              // ignore
            }
          }

          await waitForCanPlay(el)

          if (opts?.restart) {
            try {
              el.currentTime = 0
            } catch {
              // ignore
            }
          }

          const p = el.play()
          if (p && typeof (p as Promise<void>).then === 'function') {
            await p
          }
        } catch {
          // Autoplay có thể bị chặn. Thử phát ở chế độ muted (thường được phép autoplay).
          const prevMuted = el.muted
          try {
            el.muted = true
            const p2 = el.play()
            if (p2 && typeof (p2 as Promise<void>).then === 'function') {
              await p2
            }
          } catch (err) {
            console.info('[Olympia][GuestMedia] play blocked', {
              mediaType,
              action: cmd.action,
              readyState: el.readyState,
              error: err instanceof Error ? err.message : String(err),
            })
          } finally {
            // Khôi phục trạng thái muted (nếu autoplay chỉ chạy được khi muted, user có thể tự bật âm thủ công).
            el.muted = prevMuted
          }
        }
      }

      try {
        if (action === 'pause') {
          element.pause()
          console.info('[Olympia][GuestMedia] applied pause', {
            mediaType,
            cmdId,
            paused: element.paused,
            currentTime: Number.isFinite(element.currentTime) ? element.currentTime : null,
          })
          return
        }

        // play/restart
        await tryPlay(element, { restart: action === 'restart' })
        console.info('[Olympia][GuestMedia] applied play', {
          mediaType,
          cmdId,
          paused: element.paused,
          currentTime: Number.isFinite(element.currentTime) ? element.currentTime : null,
          readyState: element.readyState,
          muted: element.muted,
        })
      } catch {
        // Trình duyệt có thể chặn autoplay; bỏ qua để tránh spam toast.
      }
    }

    void applyCommand('audio')
    void applyCommand('video')
  }, [isGuest, isWaitingScreen, resolvedViewerMode, session.guest_media_control])

  // Toast notification for session state
  useEffect(() => {
    if (!isSessionRunning) {
      toast.info('Phòng chưa mở')
    }
  }, [isSessionRunning])

  // Guest: toast tên người bấm chuông nhanh nhất (mỗi câu hỏi 1 lần)
  useEffect(() => {
    if (!isGuest) return
    if (session.buzzer_enabled === false) return
    if (!currentQuestionId) return

    const relevantEvents = currentQuestionBuzzerEvents
      .filter((e) => Boolean(e.player_id))

    if (relevantEvents.length === 0) return

    const getTimeMs = (e: (typeof relevantEvents)[number]) => {
      const ts = e.occurred_at
      const parsed = ts ? Date.parse(ts) : NaN
      return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
    }

    const fastest = [...relevantEvents].sort((a, b) => getTimeMs(a) - getTimeMs(b))[0]
    if (!fastest) return

    const fastestKey = fastest.id ?? `${fastest.player_id ?? 'unknown'}|${fastest.occurred_at ?? ''}`
    const alreadyToasted =
      lastFastestBuzzerRef.current.roundQuestionId === currentQuestionId &&
      lastFastestBuzzerRef.current.key === fastestKey
    if (alreadyToasted) return

    lastFastestBuzzerRef.current = { roundQuestionId: currentQuestionId, key: fastestKey }

    const player = fastest.player_id ? players.find((p) => p.id === fastest.player_id) ?? null : null
    const name = player?.display_name ?? (player?.seat_index != null ? `Ghế ${player.seat_index}` : 'Một thí sinh')
    toast.success(`${name} bấm nhanh nhất`)
  }, [currentQuestionBuzzerEvents, currentQuestionId, isGuest, players, session.buzzer_enabled])

  return (
    <>
      <OlympiaQuestionsPreloadOverlay
        roundQuestions={preloadRoundQuestions}
        storageKey={`olympia:preload:client:${session.id}`}
      />
      <div
        className="min-h-screen bg-black text-white flex flex-col"
        style={{
          backgroundImage: isWaitingScreen
            ? `url('/olympia-theme/pointscreen_default_O22_new.png')`
            : `url('/olympia-theme/default_background.png')`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#000',
        }}
      >
        {/* Popup mất mạng: KHÔNG hiện trên guest */}
        {!isGuest && !isOnline ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-[min(520px,calc(100%-2rem))] rounded-lg border bg-background p-6 text-foreground">
              <p className="text-sm font-semibold">Không có kết nối Internet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bạn đang offline. Hệ thống sẽ tự đồng bộ lại khi có mạng.
              </p>
            </div>
          </div>
        ) : null}

        {/* HUD (ẩn ở guest) */}
        {!isGuest ? (
          <header className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-950/70 backdrop-blur-sm">
            <div className="min-w-0 flex flex-row gap-1">
              <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 inline-w-fit">
                <p className="text-xs uppercase tracking-widest text-slate-200">
                  {questionTitle}
                  {playerTurnSuffix}
                </p>
                <p className="text-sm text-slate-100 truncate">{match.name}</p>
              </div>
            </div>

            <div className="min-w-0 flex-1 flex justify-center">
              {isMc ? (
                <div className="flex flex-wrap justify-center gap-2 max-w-[720px]">
                  <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 text-center min-w-[220px]">
                    <p className="text-xs uppercase tracking-widest text-slate-200 truncate">Lượt hiện tại</p>
                    <p className="text-sm text-slate-100 truncate">{mcTurnLabel ?? '—'}</p>
                  </div>
                  <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 text-center min-w-[220px]">
                    <p className="text-xs uppercase tracking-widest text-slate-200 truncate">Bấm chuông</p>
                    <p className="text-sm text-slate-100 truncate">{mcBuzzerLabel ?? '—'}</p>
                  </div>
                </div>
              ) : resolvedViewerMode === 'player' ? (
                <div className="flex flex-wrap justify-center gap-2 max-w-[720px]">
                  <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 text-center min-w-[220px]">
                    <p className="text-xs uppercase tracking-widest text-slate-200 truncate">Thí sinh</p>
                    <p className="text-sm text-slate-100 truncate">{viewerSeatNameText ?? '—'}</p>
                  </div>
                  <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 text-center min-w-[220px]">
                    <p className="text-xs uppercase tracking-widest text-slate-200 truncate">Bấm chuông</p>
                    <p className="text-sm text-slate-100 truncate">{playerBuzzerLabel ?? '—'}</p>
                  </div>
                </div>
              ) : turnStatusText ? (
                <div className="rounded-md px-3 py-1 bg-slate-900/50 border border-slate-700/50 text-center max-w-[520px]">
                  <p className="text-xs uppercase tracking-widest text-slate-200 truncate">Realtime</p>
                  <p className="text-sm text-slate-100 truncate">{turnStatusText ?? '—'}</p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'rounded-md px-3 py-1 font-mono text-base whitespace-nowrap border',
                  session.timer_deadline
                    ? 'border-emerald-500/60 text-emerald-100 bg-emerald-950/50'
                    : 'border-slate-500/60 text-slate-100 bg-slate-900/50'
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
        ) : null}

        {/* Overlay bảng điểm lớn (đồng bộ theo host) */}
        {showBigScoreboard ? (
          <div className="fixed inset-0 z-[60]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url('/olympia-theme/Result.png')`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundColor: '#000',
              }}
            />
            <div className="relative z-10 h-full w-full flex items-center justify-center px-4">
              <div className="w-full max-w-4xl rounded-md border border-slate-700 bg-slate-950/70 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-200">Bảng điểm</p>
                    <p className="text-sm text-slate-100 truncate">{match.name}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  {scoreboard.length > 0 ? (
                    scoreboard.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-4 rounded-md border border-slate-700 bg-slate-950/50 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <p className="text-lg sm:text-xl font-semibold text-slate-50 truncate">
                            {p.name}
                          </p>
                          <p className="text-sm text-slate-200">Ghế {p.seat ?? '—'}</p>
                        </div>
                        <p className="text-3xl sm:text-4xl font-mono font-semibold text-white">{p.total}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-200">Chưa có dữ liệu điểm.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* MAIN SCREEN */}
        <main
          className="flex-1 relative flex items-center justify-center px-6 pt-10 pb-44"

        >
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
            <div className=""></div>
          ) : (
            <div className="w-full max-w-5xl text-center">
              {showQuestionText ? (
                <p className="text-4xl sm:text-5xl font-semibold leading-snug whitespace-pre-wrap text-slate-50">
                  {questionText?.trim() ? questionText : '—'}
                </p>
              ) : null}

              {showQuestionMedia ? (
                <div className="mt-6 mx-auto max-w-4xl rounded-md border border-slate-700 bg-slate-950/60 p-3 text-left">
                  {mediaUrl ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-300">Ảnh/Video</p>
                      {mediaKind === 'image' ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={mediaUrl}
                          alt="Media câu hỏi"
                          className="w-full max-h-[420px] object-contain rounded"
                        />
                      ) : mediaKind === 'video' ? (
                        <video
                          ref={syncedVideoRef}
                          playsInline
                          src={mediaUrl}
                          className="w-full max-h-[420px] rounded bg-black pointer-events-none"
                          tabIndex={-1}
                        />
                      ) : mediaKind === 'youtube' && youtubeEmbedUrl ? (
                        <div className="aspect-video w-full overflow-hidden rounded bg-black">
                          <iframe
                            src={youtubeEmbedUrl}
                            title="Video câu hỏi"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="h-full w-full"
                          />
                        </div>
                      ) : (
                        <a
                          href={mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-sky-300 hover:underline break-all"
                        >
                          {mediaUrl}
                        </a>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {audioUrl && isGuest ? (
                // Audio chỉ phát trên Guest; ẩn UI nhưng vẫn mount để host điều khiển.
                <audio ref={guestAudioRef} src={audioUrl} preload="auto" className="hidden" aria-hidden="true" />
              ) : null}

              {shouldUseObstacleUi && obstacle ? (
                (() => {
                  const byPos = new Map<number, (typeof obstacleTiles)[number]>()
                  for (const t of obstacleTiles ?? []) {
                    if (typeof t.position_index === 'number') byPos.set(t.position_index, t)
                  }

                  const getRqAnswer = (rqId: string | null | undefined) => {
                    if (!rqId) return ''
                    const rq = roundQuestions.find((q) => q.id === rqId) ?? null
                    const raw = (rq?.answer_text ?? '').trim()
                    return raw
                  }

                  const buildBoxes = (answerText: string, reveal: boolean) => {
                    // Số ô chữ KHÔNG tính dấu cách.
                    const chars = Array.from(answerText).filter((ch) => ch.trim() !== '')
                    return (
                      <div className="flex flex-wrap justify-center gap-1">
                        {chars.map((ch, idx) => {
                          return (
                            <span
                              key={idx}
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-950/60 text-sm font-semibold"
                              aria-label={reveal ? ch.toUpperCase() : 'Ô chữ'}
                            >
                              {reveal ? ch.toUpperCase() : ''}
                            </span>
                          )
                        })}
                      </div>
                    )
                  }

                  type CoverPos = 1 | 2 | 3 | 4 | 5
                  const coverBaseClass = 'absolute border border-slate-700 bg-slate-950/80'
                  const covers: Array<{ pos: CoverPos; style: CSSProperties }> = [
                    // 4 góc: cover lớn và cắt góc trong
                    {
                      pos: 1,
                      style: {
                        left: '0%',
                        top: '0%',
                        width: '50%',
                        height: '50%',
                        clipPath: 'polygon(0% 0%, 100% 0%, 100% 55%, 55% 55%, 55% 100%, 0% 100%)',
                      },
                    },
                    {
                      pos: 2,
                      style: {
                        right: '0%',
                        top: '0%',
                        width: '50%',
                        height: '50%',
                        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 45% 100%, 45% 55%, 0% 55%)',
                      },
                    },
                    {
                      pos: 3,
                      style: {
                        left: '0%',
                        bottom: '0%',
                        width: '50%',
                        height: '50%',
                        clipPath: 'polygon(0% 0%, 55% 0%, 55% 45%, 100% 45%, 100% 100%, 0% 100%)',
                      },
                    },
                    {
                      pos: 4,
                      style: {
                        right: '0%',
                        bottom: '0%',
                        width: '50%',
                        height: '50%',
                        clipPath: 'polygon(45% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 45%, 45% 45%)',
                      },
                    },
                    // Trung tâm
                    {
                      pos: 5,
                      style: {
                        left: '27.5%',
                        top: '27.5%',
                        width: '45%',
                        height: '45%',
                      },
                    },
                  ]

                  const renderRow = (pos: number, title: string) => {
                    const tile = byPos.get(pos) ?? null
                    const answer = getRqAnswer(tile?.round_question_id)
                    const reveal = Boolean(tile?.is_open)

                    return (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-300">{title}</p>
                        {answer ? buildBoxes(answer, reveal) : <p className="text-xs text-slate-400">(Chưa có đáp án)</p>}
                      </div>
                    )
                  }

                  return (
                    <div className="mt-8 grid gap-6 md:grid-cols-2 md:items-start text-left">
                      <div className="space-y-2">
                        <div className="relative overflow-hidden rounded-md border border-slate-700 bg-slate-950/60">
                          {obstacle.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={obstacle.image_url}
                              alt={obstacle.title ?? 'Chướng ngại vật'}
                              className="h-64 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-64 w-full items-center justify-center text-sm text-slate-300">
                              (Chưa có ảnh CNV)
                            </div>
                          )}

                          {covers.map((c) => {
                            const tile = byPos.get(c.pos) ?? null
                            if (tile?.is_open) return null
                            return <div key={c.pos} className={coverBaseClass} style={c.style} aria-hidden="true" />
                          })}
                        </div>

                        <p className="text-xs text-slate-300">
                          CNV: 4 hàng ngang + 1 ô trung tâm. Ô chữ sẽ hiện khi hàng được mở.
                        </p>
                      </div>

                      <div className="space-y-3 text-center">
                        {renderRow(1, 'Hàng 1')}
                        {renderRow(2, 'Hàng 2')}
                        {renderRow(3, 'Hàng 3')}
                        {renderRow(4, 'Hàng 4')}
                        {renderRow(5, 'OTT (Ô trung tâm)')}
                        {!disableInteractions ? (
                          <p className="mt-2 text-xs text-slate-300">
                            Đoán CNV: bấm chuông (trả lời miệng). Nếu sai sẽ mất quyền đoán CNV trong vòng này.
                          </p>
                        ) : null}
                        {isViewerDisqualifiedObstacle ? (
                          <p className="mt-2 text-xs text-amber-200">
                            Bạn đã bị loại quyền trả lời ở vòng CNV này.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                })()
              ) : null}

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

          {/* Top scoreboard mini (MC): đã chuyển ra ngoài khung game qua portal */}


        </main>

        {/* INTERACTION BAR (ẩn ở guest) */}
        {!isGuest ? (
          <footer className="fixed bottom-0 left-0 right-0 z-40 px-4 py-4 border-t border-slate-700 bg-slate-950/70 backdrop-blur-sm">
            {disableInteractions ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-200">
                  {isMc
                    ? 'Chế độ MC: chỉ quan sát (không gửi đáp án / bấm chuông).'
                    : 'Chế độ khách: đăng nhập để gửi đáp án / bấm chuông.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-1 md:items-center">
                {/* Answer section - center, only show when NOT waiting screen */}
                {!isWaitingScreen && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex flex-wrap gap-3 justify-center">
                      {roundType !== 'khoi_dong' ? (
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

                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Refresh button - footer right */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Button
                size="icon"
                variant="outline"
                className="bg-slate-900/70 border-slate-600 text-white hover:bg-slate-800"
                onClick={refreshFromServer}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </footer>
        ) : null}

        {/* Buzzer FAB - bottom right corner */}
        {!disableInteractions && session.buzzer_enabled !== false && (
          <div className="fixed bottom-24 right-4 z-50">
            <form action={buzzerAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <Button
                type="submit"
                disabled={disableBuzz}
                size="lg"
                className={cn(
                  'w-36 h-36 rounded-full flex items-center justify-center shadow-lg border-0',
                  'bg-blue-600 hover:bg-blue-700 text-white',
                  'disabled:bg-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed disabled:opacity-100'
                )}
                variant="default"
              >
                <Bell className="w-24 h-24" />
              </Button>
            </form>
          </div>
        )}


      </div>

      {isMc && mcScoreboardSlotEl && scoreboard.length > 0
        ? createPortal(
          <div className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs">
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
          </div>,
          mcScoreboardSlotEl
        )
        : null}

      {isMc && mcBuzzerSlotEl
        ? createPortal(
          <div className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs">
            <p className="text-[11px] uppercase tracking-widest text-slate-200 truncate">Bấm chuông</p>
            <p className="mt-1 text-sm text-slate-100 truncate">{mcBuzzerLabel ?? '—'}</p>
          </div>,
          mcBuzzerSlotEl
        )
        : null}
    </>
  )
}
