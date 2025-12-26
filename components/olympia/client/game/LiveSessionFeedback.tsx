'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

type LiveSessionFeedbackProps = {
  message?: string | null
  isError?: boolean
}

export function LiveSessionFeedback({ message, isError }: LiveSessionFeedbackProps) {
  useEffect(() => {
    if (!message) return
    if (isError) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [message, isError])

  return null
}
