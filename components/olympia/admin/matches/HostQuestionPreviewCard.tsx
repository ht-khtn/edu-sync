'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { GuestMediaControlButtons } from '@/components/olympia/admin/matches/GuestMediaControlButtons'
import { dispatchHostSessionUpdate, subscribeHostSessionUpdate } from '@/components/olympia/admin/matches/host-events'
import { ArrowLeft, ArrowRight, Eye, Loader2 } from 'lucide-react'

type PlayerSummary = {
    seat_index: number | null
    display_name: string | null
}

type WinnerBuzzRow = {
    id: string
    player_id: string | null
    result: string | null
    occurred_at: string | null
    match_players: PlayerSummary | PlayerSummary[] | null
}

type RoundQuestionJoin = {
    image_url?: string | null
    audio_url?: string | null
}

export type HostPreviewRoundQuestion = {
    id: string
    match_round_id: string
    order_index: number
    question_id: string | null
    question_set_item_id: string | null
    target_player_id: string | null
    meta: Record<string, unknown> | null
    question_text: string | null
    answer_text: string | null
    note: string | null
    questions?: RoundQuestionJoin | RoundQuestionJoin[] | null
    question_set_items?: RoundQuestionJoin | RoundQuestionJoin[] | null
}

type ActionState = {
    error?: string | null
    success?: string | null
    data?: Record<string, unknown> | null
}

type HostControlAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>

type Props = {
    matchId: string
    liveSession: {
        id: string | null
        status: string | null
        question_state: string | null
        current_round_type: string | null
        current_round_id: string | null
        current_round_question_id: string | null
    } | null
    descriptionText: string
    options: Array<{ id: string; label: string }>
    questions: HostPreviewRoundQuestion[]
    preloadQuestions?: HostPreviewRoundQuestion[]
    initialPreviewId: string | null
    triggerReset?: boolean
    questionsDebug: {
        totalRoundQuestions: number
        currentRoundQuestionsCount: number
        currentRoundType: string | null
        currentRoundId: string | null
        byRoundType: Array<{ roundType: string; codes: string[] }>
        selectedByRoundType?: Array<{ roundType: string; codes: string[] }>
        unselectedByRoundType?: Array<{ roundType: string; codes: string[] }>
        selectedByPlayerInVeDich?: Array<{ playerId: string; fullName: string | null; selectedCodes: string[] }>
    }
    winnerBuzz: WinnerBuzzRow | null
    setCurrentQuestionFormAction: (formData: FormData) => Promise<void>
    setGuestMediaControlAction: HostControlAction
    toggleStarUseFormAction?: (formData: FormData) => Promise<void>
    isStarEnabled?: boolean
    currentTargetPlayerId?: string | null
}

function normalizePlayerSummary(value: PlayerSummary | PlayerSummary[] | null | undefined): PlayerSummary | null {
    if (!value) return null
    return Array.isArray(value) ? value[0] ?? null : value
}

function pickJoin<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null
    return Array.isArray(value) ? value[0] ?? null : value
}

function detectMediaKind(url: string | null): 'youtube' | 'video' | 'image' | 'link' | null {
    if (!url) return null
    const lower = url.toLowerCase()
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube'
    if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(lower)) return 'video'
    if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/.test(lower)) return 'image'
    return 'link'
}

function toYoutubeEmbed(url: string): string | null {
    try {
        const parsed = new URL(url)
        if (parsed.hostname.includes('youtu.be')) {
            const id = parsed.pathname.replace('/', '').trim()
            return id ? `https://www.youtube.com/embed/${id}` : null
        }
        const v = parsed.searchParams.get('v')
        return v ? `https://www.youtube.com/embed/${v}` : null
    } catch {
        return null
    }
}

function extractAssetUrls(questions: HostPreviewRoundQuestion[]): { images: string[]; audios: string[] } {
    const imgSet = new Set<string>()
    const audioSet = new Set<string>()

    for (const rq of questions) {
        const qsi = pickJoin(rq.question_set_items)
        const q = pickJoin(rq.questions)
        const imageUrl = (qsi?.image_url ?? q?.image_url ?? null)?.trim() || null
        const audioUrl = (qsi?.audio_url ?? q?.audio_url ?? null)?.trim() || null

        if (imageUrl) imgSet.add(imageUrl)
        if (audioUrl) audioSet.add(audioUrl)
    }

    return { images: Array.from(imgSet), audios: Array.from(audioSet) }
}

function hashUrls(urls: string[]): string {
    // Hash nhẹ để dùng làm key trong sessionStorage; tránh lưu chuỗi URL dài.
    // djb2-ish
    let h = 5381
    for (const url of urls) {
        for (let i = 0; i < url.length; i += 1) {
            h = ((h << 5) + h) ^ url.charCodeAt(i)
        }
    }
    // Convert to unsigned 32-bit
    return String(h >>> 0)
}

function readPreloadDone(key: string): boolean {
    if (typeof window === 'undefined') return false
    try {
        return window.sessionStorage.getItem(key) === '1'
    } catch {
        return false
    }
}

function writePreloadDone(key: string) {
    if (typeof window === 'undefined') return
    try {
        window.sessionStorage.setItem(key, '1')
    } catch {
        // ignore
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
    return new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), ms)
        promise
            .then((v) => {
                clearTimeout(t)
                resolve(v)
            })
            .catch(() => {
                clearTimeout(t)
                resolve(null)
            })
    })
}

async function preloadImages(urls: string[], onProgress: () => void): Promise<void> {
    const concurrency = 6
    let idx = 0

    const runOne = async (url: string) => {
        const p = new Promise<void>((resolve) => {
            const img = new Image()
            img.onload = () => resolve()
            img.onerror = () => resolve()
            img.src = url
        })
        await withTimeout(p, 7000)
        onProgress()
    }

    const workers = Array.from({ length: Math.min(concurrency, urls.length) }).map(async () => {
        while (idx < urls.length) {
            const cur = idx
            idx += 1
            const url = urls[cur]
            if (!url) continue
            await runOne(url)
        }
    })

    await Promise.all(workers)
}

async function preloadAudios(urls: string[], onProgress: () => void): Promise<void> {
    const concurrency = 4
    let idx = 0

    const runOne = async (url: string) => {
        const p = new Promise<void>((resolve) => {
            try {
                const audio = new Audio()
                audio.preload = 'auto'
                audio.oncanplaythrough = () => resolve()
                audio.onerror = () => resolve()
                audio.src = url
                audio.load()
            } catch {
                resolve()
            }
        })
        await withTimeout(p, 7000)
        onProgress()
    }

    const workers = Array.from({ length: Math.min(concurrency, urls.length) }).map(async () => {
        while (idx < urls.length) {
            const cur = idx
            idx += 1
            const url = urls[cur]
            if (!url) continue
            await runOne(url)
        }
    })

    await Promise.all(workers)
}

export function HostQuestionPreviewCard(props: Props) {
    const {
        matchId,
        liveSession,
        descriptionText,
        options,
        questions,
        preloadQuestions,
        initialPreviewId,
        triggerReset,
        questionsDebug,
        winnerBuzz,
        setCurrentQuestionFormAction,
        setGuestMediaControlAction,
        toggleStarUseFormAction,
        isStarEnabled,
        currentTargetPlayerId,
    } = props

    const [previewId, setPreviewId] = useState<string>(() => initialPreviewId ?? '')
    const questionsForPreload = preloadQuestions ?? questions
    const assets = useMemo(() => extractAssetUrls(questionsForPreload), [questionsForPreload])
    const preloadTotal = assets.images.length + assets.audios.length
    const preloadKey = useMemo(() => {
        const urls = [...assets.images, ...assets.audios].sort()
        const h = hashUrls(urls)
        return `olympia:preload:host:${matchId}:${h}`
    }, [assets.audios, assets.images, matchId])

    // Tránh hydration mismatch: server không đọc được sessionStorage, nên không quyết định UI theo window trong initial render.
    const [isPreloading, setIsPreloading] = useState(false)
    const [preloadDoneCount, setPreloadDoneCount] = useState(0)
    const prevTriggerRef = useRef(triggerReset)

    useEffect(() => {
        if (triggerReset && !prevTriggerRef.current) {
            queueMicrotask(() => {
                setPreviewId('')
            })
        }
        prevTriggerRef.current = triggerReset
    }, [triggerReset])

    // Nếu server refresh đổi initialPreviewId (VD: mới bấm Show đổi live), đồng bộ lại.
    useEffect(() => {
        queueMicrotask(() => {
            setPreviewId(initialPreviewId ?? '')
        })
    }, [initialPreviewId])

    // Đồng bộ theo realtime/optimistic event để tránh router.refresh() toàn trang.
    useEffect(() => {
        return subscribeHostSessionUpdate((payload) => {
            queueMicrotask(() => {
                setPreviewId(payload.currentRoundQuestionId ?? '')
            })
        })
    }, [])

    const previewIndex = useMemo(() => {
        if (!previewId) return -1
        return questions.findIndex((q) => q.id === previewId)
    }, [previewId, questions])

    const previewPrevId = previewIndex > 0 ? questions[previewIndex - 1]?.id ?? null : null
    const previewNextId =
        previewIndex >= 0 && previewIndex < questions.length - 1 ? questions[previewIndex + 1]?.id ?? null : null

    const previewRoundQuestion = useMemo(() => {
        if (!previewId) return null
        return questions.find((q) => q.id === previewId) ?? null
    }, [previewId, questions])

    const previewQuestionText = previewRoundQuestion?.question_text ?? null
    const previewAnswerText = previewRoundQuestion?.answer_text ?? null
    const previewNoteText = previewRoundQuestion?.note ?? null

    const handleSetCurrentQuestion = async (formData: FormData) => {
        const raw = formData.get('roundQuestionId')
        const nextId = typeof raw === 'string' && raw.trim() ? raw : null
        if (nextId) {
            dispatchHostSessionUpdate({ currentRoundQuestionId: nextId, questionState: 'showing', source: 'optimistic' })
        }
        await setCurrentQuestionFormAction(formData)
    }

    useEffect(() => {
        let cancelled = false

        // Nếu đã preload xong (trong sessionStorage) thì không chạy lại.
        if (readPreloadDone(preloadKey)) {
            queueMicrotask(() => {
                setIsPreloading(false)
            })
            return () => {
                cancelled = true
            }
        }

        const run = async () => {
            setIsPreloading(true)
            setPreloadDoneCount(0)

            const bump = () => {
                if (cancelled) return
                setPreloadDoneCount((v) => v + 1)
            }

            // Nếu không có gì để preload thì vẫn chờ 1 microtask để overlay không bị giật.
            if (preloadTotal === 0) {
                await Promise.resolve()
                if (!cancelled) {
                    writePreloadDone(preloadKey)
                    setIsPreloading(false)
                }
                return
            }

            await Promise.all([
                preloadImages(assets.images, bump),
                preloadAudios(assets.audios, bump),
            ])

            if (!cancelled) {
                writePreloadDone(preloadKey)
                setIsPreloading(false)
            }
        }

        void run()

        return () => {
            cancelled = true
        }
    }, [assets.audios, assets.images, preloadKey, preloadTotal])

    return (
        <Card>
            {isPreloading ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="rounded-lg border bg-background p-6 w-[min(520px,calc(100%-2rem))]">
                        <div className="flex items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <div>
                                <p className="text-sm font-semibold">Đang tải dữ liệu câu hỏi…</p>
                                <p className="text-xs text-muted-foreground">
                                    Vui lòng chờ, hệ thống đang preload để chuyển câu tức thì.
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">
                            Tiến độ: {Math.min(preloadDoneCount, preloadTotal)}/{preloadTotal}
                        </div>
                    </div>
                </div>
            ) : null}

            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                        <CardTitle className="text-base">Câu hỏi</CardTitle>
                        <CardDescription>{descriptionText}</CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            size="icon-sm"
                            variant="outline"
                            title="Xem câu trước"
                            aria-label="Xem câu trước"
                            disabled={!previewPrevId}
                            onClick={() => {
                                if (previewPrevId) setPreviewId(previewPrevId)
                            }}
                        >
                            <ArrowLeft />
                        </Button>

                        <select
                            value={previewId}
                            onChange={(e) => setPreviewId(e.target.value)}
                            className="w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                            disabled={options.length === 0}
                            aria-label="Danh sách câu hỏi"
                        >
                            {options.length === 0 ? (
                                <option value="" disabled>
                                    Chưa có câu trong vòng
                                </option>
                            ) : (
                                <option value="">Chưa có câu hỏi</option>
                            )}
                            {options.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>

                        <Button
                            size="icon-sm"
                            variant="outline"
                            title="Xem câu sau"
                            aria-label="Xem câu sau"
                            disabled={!previewNextId}
                            onClick={() => {
                                if (previewNextId) setPreviewId(previewNextId)
                            }}
                        >
                            <ArrowRight />
                        </Button>

                        <form action={handleSetCurrentQuestion} className="flex">
                            <input type="hidden" name="matchId" value={matchId} />
                            <input type="hidden" name="roundQuestionId" value={previewId} />
                            {/* Không auto-start timer khi show câu */}
                            <Button
                                type="submit"
                                size="icon-sm"
                                disabled={!previewId}
                                title="Show lên (đổi câu đang live)"
                                aria-label="Show lên (đổi câu đang live)"
                            >
                                <Eye />
                            </Button>
                        </form>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="rounded-lg border bg-background p-4">
                    <details className="mb-3">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                            Debug danh sách câu theo vòng
                        </summary>
                        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                            <p>
                                current_round_type:{' '}
                                <span className="font-mono">{questionsDebug.currentRoundType ?? '—'}</span>
                                {' '}· current_round_id: <span className="font-mono">{questionsDebug.currentRoundId ?? '—'}</span>
                                {' '}· total RQ: <span className="font-mono">{questionsDebug.totalRoundQuestions}</span>
                                {' '}· RQ in current round: <span className="font-mono">{questionsDebug.currentRoundQuestionsCount}</span>
                            </p>
                            {questionsDebug.byRoundType.length === 0 ? (
                                <p>(Không có round_questions)</p>
                            ) : (
                                <div className="space-y-1">
                                    {questionsDebug.byRoundType.map((entry) => (
                                        <p key={entry.roundType}>
                                            <span className="font-mono">{entry.roundType}</span>
                                            {': '}
                                            {entry.codes.join(', ')}
                                        </p>
                                    ))}
                                </div>
                            )}
                            <hr className="my-2 border-muted" />
                            <p className="text-xs font-semibold text-foreground">Câu đã chọn:</p>
                            {questionsDebug.selectedByRoundType && questionsDebug.selectedByRoundType.length === 0 ? (
                                <p className="text-xs text-muted-foreground">(Không có)</p>
                            ) : (
                                <div className="space-y-1">
                                    {questionsDebug.selectedByRoundType?.map((entry) => (
                                        <p key={`sel-${entry.roundType}`} className="text-xs text-green-700 font-mono">
                                            <span className="font-mono">{entry.roundType}</span>
                                            {': '}
                                            {entry.codes.join(', ')}
                                        </p>
                                    ))}
                                </div>
                            )}
                            <p className="mt-1 text-xs font-semibold text-foreground">Câu chưa chọn:</p>
                            {questionsDebug.unselectedByRoundType && questionsDebug.unselectedByRoundType.length === 0 ? (
                                <p className="text-xs text-muted-foreground">(Không có)</p>
                            ) : (
                                <div className="space-y-1">
                                    {questionsDebug.unselectedByRoundType?.map((entry) => (
                                        <p key={`unsel-${entry.roundType}`} className="text-xs text-red-700 font-mono">
                                            <span className="font-mono">{entry.roundType}</span>
                                            {': '}
                                            {entry.codes.join(', ')}
                                        </p>
                                    ))}
                                </div>
                            )}
                            <hr className="my-2 border-muted" />
                            <p className="text-xs font-semibold text-foreground">Câu đã chọn theo thí sinh (Về đích):</p>
                            {questionsDebug.selectedByPlayerInVeDich && questionsDebug.selectedByPlayerInVeDich.length === 0 ? (
                                <p className="text-xs text-muted-foreground">(Không có)</p>
                            ) : (
                                <div className="space-y-1">
                                    {questionsDebug.selectedByPlayerInVeDich?.map((entry) => (
                                        <p key={`sel-player-${entry.playerId}`} className="text-xs text-blue-700 font-mono">
                                            <span className="font-semibold">{entry.fullName ?? 'Thí sinh'}</span>
                                            {': '}
                                            {entry.selectedCodes.length > 0 ? entry.selectedCodes.join(', ') : '(chưa chọn)'}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </details>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                            {liveSession?.current_round_question_id
                                ? `Live RQ: ${liveSession.current_round_question_id}`
                                : 'Chưa show câu'}
                            {previewId && previewId !== liveSession?.current_round_question_id ? ` · Đang xem: ${previewId}` : ''}
                        </p>
                        {winnerBuzz ? (
                            <p className="text-xs text-muted-foreground">
                                Winner: Ghế {normalizePlayerSummary(winnerBuzz.match_players)?.seat_index ?? '—'}
                            </p>
                        ) : null}
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-lg font-semibold leading-relaxed">
                        {previewQuestionText ?? (previewRoundQuestion ? `ID: ${previewRoundQuestion.id}` : 'Chưa có câu hỏi')}
                    </p>

                    {(() => {
                        const rq = previewRoundQuestion
                        const qsi = pickJoin(rq?.question_set_items)
                        const q = pickJoin(rq?.questions)
                        const mediaUrl = (qsi?.image_url ?? q?.image_url ?? null)?.trim() || null
                        const audioUrl = (qsi?.audio_url ?? q?.audio_url ?? null)?.trim() || null
                        const kind = detectMediaKind(mediaUrl)
                        const yt = kind === 'youtube' && mediaUrl ? toYoutubeEmbed(mediaUrl) : null

                        if (!mediaUrl && !audioUrl) return null

                        return (
                            <div className="mt-4 rounded-md border bg-white p-3 space-y-3">
                                {mediaUrl ? (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-slate-700">Ảnh/Video</p>
                                        {kind === 'image' ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={mediaUrl}
                                                alt="Media câu hỏi"
                                                className="w-full max-h-[360px] object-contain rounded"
                                            />
                                        ) : kind === 'video' ? (
                                            <video controls playsInline src={mediaUrl} className="w-full max-h-[360px] rounded bg-black" />
                                        ) : kind === 'youtube' && yt ? (
                                            <div className="aspect-video w-full overflow-hidden rounded bg-black">
                                                <iframe
                                                    src={yt}
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
                                                className="text-sm text-blue-600 hover:underline break-all"
                                            >
                                                {mediaUrl}
                                            </a>
                                        )}

                                        {kind === 'video' && liveSession?.status === 'running' ? (
                                            <GuestMediaControlButtons
                                                matchId={matchId}
                                                mediaType="video"
                                                action={setGuestMediaControlAction}
                                            />
                                        ) : null}
                                    </div>
                                ) : null}

                                {audioUrl ? (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-slate-700">Âm thanh</p>
                                        <audio controls src={audioUrl} className="w-full" />

                                        {liveSession?.status === 'running' ? (
                                            <GuestMediaControlButtons
                                                matchId={matchId}
                                                mediaType="audio"
                                                action={setGuestMediaControlAction}
                                            />
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        )
                    })()}

                    {previewAnswerText ? (
                        <div className="mt-4 rounded-md border bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-700">Đáp án</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">{previewAnswerText}</p>
                            {previewNoteText ? (
                                <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">Ghi chú: {previewNoteText}</p>
                            ) : null}
                        </div>
                    ) : null}

                    {liveSession?.current_round_type === 've_dich' && toggleStarUseFormAction && previewRoundQuestion ? (
                        <div className="mt-4 rounded-md border bg-amber-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-amber-900">Ngôi sao hy vọng</p>
                                    <p className="mt-1 text-xs text-amber-700">
                                        {isStarEnabled ? 'Đang bật: Nhân đôi điểm đúng, trừ điểm sai' : 'Tắt'}
                                    </p>
                                </div>
                                <Switch
                                    checked={isStarEnabled}
                                    onCheckedChange={async (checked) => {
                                        try {
                                            const formData = new FormData()
                                            formData.append('matchId', matchId)
                                            formData.append('roundQuestionId', previewRoundQuestion.id)
                                            formData.append('playerId', currentTargetPlayerId ?? '')
                                            if (checked) {
                                                formData.append('enabled', '1')
                                            }
                                            await toggleStarUseFormAction(formData)
                                        } catch (err) {
                                            console.error('Toggle star error:', err)
                                        }
                                    }}
                                    aria-label="Toggle ngôi sao hy vọng"
                                />
                            </div>
                        </div>
                    ) : null}

                    {!liveSession?.current_round_question_id ? (
                        <div className="mt-3">
                            <Badge variant="outline">Chưa có câu đang live</Badge>
                        </div>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    )
}
