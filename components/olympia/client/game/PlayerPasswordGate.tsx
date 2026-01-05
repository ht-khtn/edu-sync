import type { LiveSessionRow } from '@/types/olympia/game'
import { lookupJoinCodeAction } from '@/app/(olympia)/olympia/actions'
import { PlayerPasswordGateClient } from '@/components/olympia/client/game/PlayerPasswordGateClient'

type PlayerPasswordGateProps = {
  session: LiveSessionRow
  userAlreadyVerified?: boolean
  children: React.ReactNode
}

export function PlayerPasswordGate({ session, userAlreadyVerified = false, children }: PlayerPasswordGateProps) {
  return (
    <PlayerPasswordGateClient
      session={session}
      userAlreadyVerified={userAlreadyVerified}
      lookupJoinCodeAction={lookupJoinCodeAction}
    >
      {children}
    </PlayerPasswordGateClient>
  )
}
