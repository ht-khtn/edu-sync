'use client'

import { useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type ErrorBoundaryProps = {
    error: Error & { digest?: string }
    reset: () => void
}

export default function OlympiaHowToJoinError({ error, reset }: ErrorBoundaryProps) {
    useEffect(() => {
        console.error('Olympia how-to-join route error', error)
    }, [error])

    return (
        <div className="space-y-4">
            <Alert variant="destructive">
                <AlertTitle>Không tải được hướng dẫn</AlertTitle>
                <AlertDescription>
                    Có lỗi xảy ra khi tải trang hướng dẫn. Vui lòng thử tải lại.
                </AlertDescription>
            </Alert>
            <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>
                    Thử lại
                </Button>
                <Button variant="outline" asChild>
                    <Link href="/olympia/client">Quay lại trang chủ</Link>
                </Button>
            </div>
        </div>
    )
}
