'use client'

import { useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type ErrorBoundaryProps = {
    error: Error & { digest?: string }
    reset: () => void
}

export default function OlympiaClientHomeError({ error, reset }: ErrorBoundaryProps) {
    useEffect(() => {
        console.error('Olympia client home route error', error)
    }, [error])

    return (
        <div className="space-y-4">
            <Alert variant="destructive">
                <AlertTitle>Không tải được trang chủ</AlertTitle>
                <AlertDescription>
                    Có lỗi xảy ra khi tải trang chủ Olympia. Vui lòng thử tải lại trang.
                </AlertDescription>
            </Alert>
            <Button variant="outline" onClick={reset}>
                Thử lại
            </Button>
        </div>
    )
}
