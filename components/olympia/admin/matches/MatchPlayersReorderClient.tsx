'use client'

import { useEffect, useMemo, useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { GripVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import type { ActionState } from '@/app/(olympia)/olympia/actions'

type Player = {
    id: string
    seat_index: number
    display_name: string | null
    participant_id: string | null
}

type ParticipantInfo = {
    contestant_code: string | null
    role: string | null
    display_name?: string | null
    class_name?: string | null | Array<{ class_name: string | null }>
}

type UpdateMatchPlayersOrderAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>

export interface MatchPlayersReorderClientProps {
    matchId: string
    players: Player[]
    participantLookup: Map<string, ParticipantInfo>
    updateOrderAction: UpdateMatchPlayersOrderAction
}

const actionInitialState: ActionState = { error: null, success: null }

function ReorderSubmitButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} size="sm">
            {pending ? 'Đang cập nhật...' : 'Lưu thứ tự'}
        </Button>
    )
}

export function MatchPlayersReorderClient({ matchId, players, participantLookup, updateOrderAction }: MatchPlayersReorderClientProps) {
    const initialSorted = useMemo(() => [...players].sort((a, b) => a.seat_index - b.seat_index), [players])
    const [playerList, setPlayerList] = useState<Player[]>(initialSorted)
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [isRemoving, setIsRemoving] = useState(false)

    // Listen for player-added events to update list without full reload
    useEffect(() => {
        function onPlayerAdded(e: Event) {
            const detail = (e as CustomEvent).detail as Player | null
            if (!detail) return
            // only add if belongs to this match
            // detail.match_id may or may not exist; defensively check
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matchIdOfDetail = (detail as any).match_id as string | undefined
            if (matchIdOfDetail && matchIdOfDetail !== matchId) return

            setPlayerList((prev) => {
                // ignore if already exists
                if (prev.some((p) => p.id === detail.id)) return prev
                const merged = [...prev, { id: detail.id, seat_index: detail.seat_index, display_name: detail.display_name ?? null, participant_id: detail.participant_id ?? null }]
                return merged.sort((a, b) => a.seat_index - b.seat_index)
            })
        }

        window.addEventListener('olympia:player-added', onPlayerAdded as EventListener)
        return () => window.removeEventListener('olympia:player-added', onPlayerAdded as EventListener)
    }, [matchId])

    const [orderState, formAction] = useActionState(updateOrderAction, actionInitialState)

    useEffect(() => {
        if (orderState.error) toast.error(orderState.error)
        if (orderState.success) {
            toast.success(orderState.success)
            window.location.reload()
        }
    }, [orderState.error, orderState.success])

    function handleDragStart(index: number) {
        setDraggedIndex(index)
    }

    function handleDragOver(e: React.DragEvent) {
        e.preventDefault()
    }

    function handleDrop(targetIndex: number) {
        if (draggedIndex === null || draggedIndex === targetIndex) {
            setDraggedIndex(null)
            return
        }

        const newList = [...playerList]
        const draggedItem = newList[draggedIndex]
        if (!draggedItem) {
            setDraggedIndex(null)
            return
        }

        newList.splice(draggedIndex, 1)
        newList.splice(targetIndex, 0, draggedItem)
        setPlayerList(newList)
        setDraggedIndex(null)
    }

    async function handleRemovePlayer(playerId: string) {
        setIsRemoving(true)
        try {
            const response = await fetch(`/api/olympia/match-players-remove?id=${playerId}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                const result: { error?: string } = await response.json()
                toast.error(result.error || 'Không thể xóa thí sinh')
                return
            }

            setPlayerList((prev) => prev.filter((p) => p.id !== playerId))
            toast.success('Đã xóa thí sinh khỏi trận')

            setTimeout(() => window.location.reload(), 500)
        } catch (error) {
            console.error('[RemovePlayer]', error)
            toast.error('Lỗi khi xóa thí sinh')
        } finally {
            setIsRemoving(false)
        }
    }

    if (playerList.length === 0) {
        return <p className="text-sm text-muted-foreground">Chưa có thí sinh nào được gán cho trận này.</p>
    }

    return (
        <form action={formAction} className="space-y-3">
            <input type="hidden" name="matchId" value={matchId} />
            {playerList.map((player, index) => (
                <input
                    key={`${player.id}:${index}`}
                    type="hidden"
                    name="playerOrder[]"
                    value={JSON.stringify({ playerId: player.id, seatIndex: index + 1 })}
                />
            ))}

            <div className="space-y-2">
                {playerList.map((player, index) => {
                    const participant = player.participant_id ? participantLookup.get(player.participant_id) : null
                    const code = participant?.contestant_code ?? '—'
                    const name = participant?.display_name ?? player.display_name ?? '—'
                    const classInfo = Array.isArray(participant?.class_name)
                        ? participant?.class_name[0]?.class_name
                        : (participant?.class_name as string | null | undefined)
                    const cls = classInfo ?? '—'

                    return (
                        <div
                            key={player.id}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(index)}
                            className={`flex items-center gap-3 rounded-lg border-2 bg-slate-50 p-3 transition-all ${draggedIndex === index
                                ? 'border-blue-400 bg-blue-50 opacity-50'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-100 cursor-move'
                                }`}
                        >
                            <GripVertical className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                            <div className="flex-1">
                                <p className="text-sm font-medium">Ghế {index + 1}: {`${code} - ${name} - ${cls}`}</p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.preventDefault()
                                    void handleRemovePlayer(player.id)
                                }}
                                disabled={isRemoving}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    )
                })}
            </div>

            <div className="pt-3">
                <ReorderSubmitButton />
            </div>
        </form>
    )
}
