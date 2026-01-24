'use client'

import { useActionState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Pause, Play, Square } from 'lucide-react'

type ActionState = {
    error?: string | null
    success?: string | null
    data?: Record<string, unknown> | null
}

type GuestMediaType = 'audio' | 'video'

type GuestMediaCommand = 'play' | 'pause' | 'stop'

type HostControlAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>

const initialState: ActionState = { error: null, success: null, data: null }

function getIcon(command: GuestMediaCommand) {
    if (command === 'play') return <Play className="h-4 w-4" />
    if (command === 'pause') return <Pause className="h-4 w-4" />
    return <Square className="h-4 w-4" />
}

function getAriaLabel(mediaType: GuestMediaType, command: GuestMediaCommand) {
    const target = mediaType === 'audio' ? 'âm thanh' : 'video'
    if (command === 'play') return `Phát ${target} trên Guest`
    if (command === 'pause') return `Tạm dừng ${target} trên Guest`
    return `Dừng ${target} trên Guest`
}

export function GuestMediaControlButtons(props: {
    matchId: string
    mediaType: GuestMediaType
    action: HostControlAction
}) {
    const { matchId, mediaType, action } = props

    const [state, formAction, isPending] = useActionState(action, initialState)

    const commands = useMemo<GuestMediaCommand[]>(() => ['play', 'pause', 'stop'], [])

    useEffect(() => {
        if (state.error) {
            console.info('[Olympia][HostMedia] action error:', state.error)
            console.info('[Olympia][HostMedia] action error details', {
                matchId,
                mediaType,
                error: state.error,
            })
        } else if (state.success) {
            console.info('[Olympia][HostMedia] action success:', state.success)
            console.info('[Olympia][HostMedia] action success details', {
                matchId,
                mediaType,
                success: state.success,
            })
        }
    }, [matchId, mediaType, state.error, state.success])

    return (
        <div className="flex flex-wrap gap-2 pt-2">
            <p className="w-full text-[11px] text-muted-foreground">
                Điều khiển Guest ({mediaType === 'audio' ? 'Audio' : 'Video'})
            </p>
            {commands.map((command) => (
                <form
                    key={command}
                    action={formAction}
                    onSubmit={() => {
                        console.info('[Olympia][HostMedia] submit', {
                            matchId,
                            mediaType,
                            command,
                            at: new Date().toISOString(),
                        })
                    }}
                >
                    <input type="hidden" name="matchId" value={matchId} />
                    <input type="hidden" name="mediaType" value={mediaType} />
                    <input type="hidden" name="command" value={command} />
                    <Button
                        type="submit"
                        size="icon"
                        variant="outline"
                        aria-label={getAriaLabel(mediaType, command)}
                        title={command}
                        disabled={isPending}
                        onClick={() => {
                            console.info('[Olympia][HostMedia] click', {
                                matchId,
                                mediaType,
                                command,
                                at: new Date().toISOString(),
                            })
                        }}
                    >
                        {getIcon(command)}
                    </Button>
                </form>
            ))}
        </div>
    )
}
