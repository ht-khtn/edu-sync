'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { updateMatchPlayersOrderAction } from '@/app/(olympia)/olympia/actions'
import { useFormStatus } from 'react-dom'
import { GripVertical } from 'lucide-react'

type Player = {
    id: string
    seat_index: number
    display_name: string | null
    participant_id: string | null
}

type ParticipantInfo = {
    contestant_code: string | null
    role: string | null
}

interface MatchPlayersReorderProps {
    matchId: string
    players: Player[]
    participantLookup: Map<string, ParticipantInfo>
}

function ReorderSubmitButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} size="sm">
            {pending ? 'Đang cập nhật...' : 'Lưu thứ tự'}
        </Button>
    )
}

export function MatchPlayersReorder({
    matchId,
    players,
    participantLookup,
}: MatchPlayersReorderProps) {
    const [playerList, setPlayerList] = useState<Player[]>(
        players.sort((a, b) => a.seat_index - b.seat_index)
    )
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

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
        newList.splice(draggedIndex, 1)
        newList.splice(targetIndex, 0, draggedItem)
        setPlayerList(newList)
        setDraggedIndex(null)
    }

    async function handleReorder(formData: FormData) {
        formData.set('matchId', matchId)

        // Prepare player order with new seat indices
        const playerOrder = playerList.map((player, index) => ({
            playerId: player.id,
            seatIndex: index + 1, // seat_index from 1 to 4
        }))

        playerOrder.forEach((order) => {
            formData.append('playerOrder[]', JSON.stringify(order))
        })

        const result = await updateMatchPlayersOrderAction({} as any, formData)
        if (result.success) {
            // Refresh page or show success message
            window.location.reload()
        }
    }

    if (playerList.length === 0) {
        return <p className="text-sm text-muted-foreground">Chưa có thí sinh nào được gán cho trận này.</p>
    }

    return (
        <form action={handleReorder} className="space-y-3">
            <div className="space-y-2">
                {playerList.map((player, index) => {
                    const participant = player.participant_id
                        ? participantLookup.get(player.participant_id)
                        : null
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
                                <p className="text-sm font-medium">
                                    Ghế {index + 1}: {player.display_name ?? '—'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {participant?.contestant_code || '—'} · {participant?.role || 'contestant'}
                                </p>
                            </div>
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

