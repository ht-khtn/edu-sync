import { createTournamentAction } from '@/app/(olympia)/olympia/actions'
import { CreateTournamentDialogClient } from './CreateTournamentDialog'

export function CreateTournamentDialog() {
  return <CreateTournamentDialogClient action={createTournamentAction} />
}
