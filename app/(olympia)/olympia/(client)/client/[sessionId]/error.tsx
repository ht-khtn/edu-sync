'use client'

import { useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type ErrorBoundaryProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function OlympiaGameError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('Olympia game route error', error)
  }, [error])

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTitle>Không tải được trận</AlertTitle>
        <AlertDescription>
          Có lỗi xảy ra khi tải thông tin phòng Olympia. Bạn có thể thử tải lại trang hoặc quay lại danh sách trận.
        </AlertDescription>
      </Alert>
      <Button variant="outline" onClick={reset}>
        Thử lại
      </Button>
    </div>
  )
}
