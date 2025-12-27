'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'

type Participant = {
    user_id: string
    contestant_code: string | null
    display_name?: string | null
}

type MatchPlayer = {
    id: string
    participant_id: string
    seat_index: number
    match_id: string
}

interface AddPlayersToMatchProps {
    matchId: string
    availableParticipants: Participant[]
    currentPlayers: MatchPlayer[]
    onAddSuccess?: () => void
}

function AddPlayerSubmitButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} size="sm">
            {pending ? 'Đang thêm...' : 'Thêm thí sinh'}
        </Button>
    )
}

export function AddPlayersToMatch({
    matchId,
    availableParticipants,
    currentPlayers,
    onAddSuccess,
}: AddPlayersToMatchProps) {
    const [selectedParticipant, setSelectedParticipant] = useState<string>('')
    const [selectedSeat, setSelectedSeat] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)

    // Get list of already assigned participants
    const assignedParticipantIds = new Set(currentPlayers.map((p) => p.participant_id))

    // Filter available participants (remove already assigned)
    const unassignedParticipants = availableParticipants.filter(
        (p) => !assignedParticipantIds.has(p.user_id)
    )

    // Get occupied seats
    const occupiedSeats = new Set(currentPlayers.map((p) => p.seat_index))
    const availableSeats = [1, 2, 3, 4].filter((s) => !occupiedSeats.has(s))

    async function handleAddPlayer() {
        if (!selectedParticipant || !selectedSeat) {
            toast.error('Vui lòng chọn thí sinh và ghế')
            return
        }

        setIsLoading(true)
        try {
            const response = await fetch('/api/olympia/match-players', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId,
                    participantId: selectedParticipant,
                    seatIndex: parseInt(selectedSeat, 10),
                }),
            })

            const result = await response.json()
            if (!response.ok) {
                toast.error(result.error || 'Không thể thêm thí sinh')
                return
            }

            toast.success('Đã thêm thí sinh vào trận')
            setSelectedParticipant('')
            setSelectedSeat('')
            onAddSuccess?.()
        } catch (error) {
            console.error('[AddPlayersToMatch]', error)
            toast.error('Lỗi khi thêm thí sinh')
        } finally {
            setIsLoading(false)
        }
    }

    if (unassignedParticipants.length === 0) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Tất cả thí sinh đã được gán hoặc không có thí sinh khả dụng.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Thêm thí sinh vào trận</CardTitle>
                <CardDescription>Chọn thí sinh chưa được gán và ghế trống</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div>
                    <label className="block text-sm font-medium mb-2">Chọn thí sinh</label>
                    <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
                        <SelectTrigger>
                            <SelectValue placeholder="Chọn thí sinh..." />
                        </SelectTrigger>
                        <SelectContent>
                            {unassignedParticipants.map((p) => (
                                <SelectItem key={p.user_id} value={p.user_id}>
                                    {p.contestant_code || p.user_id}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Chọn ghế</label>
                    <Select value={selectedSeat} onValueChange={setSelectedSeat}>
                        <SelectTrigger>
                            <SelectValue placeholder="Chọn ghế..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableSeats.map((seat) => (
                                <SelectItem key={seat} value={String(seat)}>
                                    Ghế {seat}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    onClick={handleAddPlayer}
                    disabled={!selectedParticipant || !selectedSeat || isLoading}
                    className="w-full"
                >
                    {isLoading ? 'Đang thêm...' : 'Thêm thí sinh'}
                </Button>
            </CardContent>
        </Card>
    )
}
