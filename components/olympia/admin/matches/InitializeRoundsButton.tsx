'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { createMatchRoundsAction, type ActionState } from '@/app/(olympia)/olympia/actions'

const initialState: ActionState = { error: null, success: null }

type Props = {
  matchId: string
  roundsCount: number
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending} className="gap-2">
      <Plus className="h-4 w-4" />
      {pending ? 'Đang tạo…' : 'Tạo 4 vòng mặc định'}
    </Button>
  )
}

export function InitializeRoundsButton({ matchId, roundsCount }: Props) {
  const [state, action] = useActionState(createMatchRoundsAction, initialState)

  useEffect(() => {
    if (state.error) {
      toast.error(state.error)
    } else if (state.success) {
      toast.success(state.success)
    }
  }, [state.error, state.success])

  if (roundsCount > 0) {
    return null
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="matchId" value={matchId} />
      <SubmitButton />
    </form>
  )
}
