'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'

type Props = {
    hint: string
    scoringPlayerLabel: string | null
    isVeDich: boolean
    showTimeoutButton: boolean
    showTimerStartButton: boolean
    disabled: boolean
    matchId: string
    sessionId: string
    playerId: string
    durationMs: number
    confirmDecisionAndAdvanceFormAction: (formData: FormData) => Promise<void>
    startSessionTimerFormAction: (formData: FormData) => Promise<void>
    confirmVeDichMainDecisionFormAction: (formData: FormData) => Promise<void>
}

export function HostQuickScorePanel(props: Props) {
    const {
        hint,
        scoringPlayerLabel,
        isVeDich,
        showTimeoutButton,
        showTimerStartButton,
        disabled,
        matchId,
        sessionId,
        playerId,
        durationMs,
        confirmDecisionAndAdvanceFormAction,
        startSessionTimerFormAction,
        confirmVeDichMainDecisionFormAction,
    } = props

    const [locked, setLocked] = useState(false)

    const allDisabled = useMemo(() => disabled || locked, [disabled, locked])

    return (
        <div className="mt-4 rounded-md border bg-background p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{hint}</p>
                    {scoringPlayerLabel ? (
                        <p className="text-xs text-muted-foreground">
                            Đang chấm điểm cho thí sinh <span className="font-semibold">({scoringPlayerLabel})</span>
                        </p>
                    ) : null}
                </div>

                {showTimeoutButton ? (
                    <form
                        action={confirmDecisionAndAdvanceFormAction}
                        onSubmit={() => {
                            setLocked(true)
                        }}
                    >
                        <input type="hidden" name="matchId" value={matchId} />
                        <input type="hidden" name="sessionId" value={sessionId} />
                        <input type="hidden" name="playerId" value={playerId} />
                        <input type="hidden" name="durationMs" value={durationMs} />
                        <input type="hidden" name="decision" value="timeout" />
                        <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-xs disabled:opacity-40"
                            disabled={allDisabled}
                            title="Hết giờ"
                            aria-label="Hết giờ"
                        >
                            Hết giờ
                        </Button>
                    </form>
                ) : showTimerStartButton ? (
                    <form
                        action={startSessionTimerFormAction}
                        onSubmit={() => {
                            // Bấm giờ không nên lock chấm nhanh.
                        }}
                    >
                        <input type="hidden" name="sessionId" value={sessionId} />
                        <input type="hidden" name="durationMs" value={durationMs} />
                        <Button
                            type="submit"
                            size="sm"
                            variant="default"
                            className="h-8 px-3 text-xs disabled:opacity-40"
                            disabled={disabled}
                            title="Bấm giờ"
                            aria-label="Bấm giờ"
                        >
                            Bấm giờ
                        </Button>
                    </form>
                ) : null}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
                {isVeDich ? (
                    <>
                        <form
                            action={confirmVeDichMainDecisionFormAction}
                            onSubmit={() => {
                                setLocked(true)
                            }}
                        >
                            <input type="hidden" name="sessionId" value={sessionId} />
                            <input type="hidden" name="decision" value="correct" />
                            <Button
                                type="submit"
                                size="lg"
                                className="w-full font-bold text-base disabled:opacity-40"
                                disabled={allDisabled}
                                title="Đúng"
                                aria-label="Đúng"
                            >
                                <Check className="w-5 h-5 mr-1" />
                                Đúng
                            </Button>
                        </form>

                        <form
                            action={confirmVeDichMainDecisionFormAction}
                            onSubmit={() => {
                                setLocked(true)
                            }}
                        >
                            <input type="hidden" name="sessionId" value={sessionId} />
                            <input type="hidden" name="decision" value="wrong" />
                            <Button
                                type="submit"
                                size="lg"
                                variant="outline"
                                className="w-full font-bold text-base disabled:opacity-40"
                                disabled={allDisabled}
                                title="Sai"
                                aria-label="Sai"
                            >
                                <X className="w-5 h-5 mr-1" />
                                Sai
                            </Button>
                        </form>
                    </>
                ) : (
                    <>
                        <form
                            action={confirmDecisionAndAdvanceFormAction}
                            onSubmit={() => {
                                setLocked(true)
                            }}
                        >
                            <input type="hidden" name="matchId" value={matchId} />
                            <input type="hidden" name="sessionId" value={sessionId} />
                            <input type="hidden" name="playerId" value={playerId} />
                            <input type="hidden" name="durationMs" value={durationMs} />
                            <input type="hidden" name="decision" value="correct" />
                            <Button
                                type="submit"
                                size="lg"
                                className="w-full font-bold text-base disabled:opacity-40"
                                disabled={allDisabled}
                                title="Đúng"
                                aria-label="Đúng"
                            >
                                <Check className="w-5 h-5 mr-1" />
                                Đúng
                            </Button>
                        </form>

                        <form
                            action={confirmDecisionAndAdvanceFormAction}
                            onSubmit={() => {
                                setLocked(true)
                            }}
                        >
                            <input type="hidden" name="matchId" value={matchId} />
                            <input type="hidden" name="sessionId" value={sessionId} />
                            <input type="hidden" name="playerId" value={playerId} />
                            <input type="hidden" name="durationMs" value={durationMs} />
                            <input type="hidden" name="decision" value="wrong" />
                            <Button
                                type="submit"
                                size="lg"
                                variant="outline"
                                className="w-full font-bold text-base disabled:opacity-40"
                                disabled={allDisabled}
                                title="Sai"
                                aria-label="Sai"
                            >
                                <X className="w-5 h-5 mr-1" />
                                Sai
                            </Button>
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}
