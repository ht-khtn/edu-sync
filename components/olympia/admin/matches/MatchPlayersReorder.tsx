import { updateMatchPlayersOrderAction } from '@/app/(olympia)/olympia/actions'
import { MatchPlayersReorderClient } from '@/components/olympia/admin/matches/MatchPlayersReorderClient'

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

interface MatchPlayersReorderProps {
    matchId: string
    players: Player[]
    participantLookup: Map<string, ParticipantInfo>
}

export function MatchPlayersReorder({ matchId, players, participantLookup }: MatchPlayersReorderProps) {
    return (
        <MatchPlayersReorderClient
            matchId={matchId}
            players={players}
            participantLookup={participantLookup}
            updateOrderAction={updateMatchPlayersOrderAction}
        />
    )
}

