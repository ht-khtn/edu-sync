'use client'

import { useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type ErrorBoundaryProps = {
    error: Error & { digest?: string }
    reset: () => void
}

export default function OlympiaWatchMatchError({ error, reset }: ErrorBoundaryProps) {
    useEffect(() => {
        console.error('Olympia watch match route error', error)
    }, [error])

    return (
        <div className="space-y-4">
            <Alert variant="destructive">
                <AlertTitle>Không tải được trận</AlertTitle>
                <AlertDescription>
                    Có lỗi xảy ra khi tải thông tin trận thi. Vui lòng thử tải lại trang hoặc quay lại danh sách trận.
                </AlertDescription>
            </Alert>
            <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>
                    Thử lại
                </Button>
                <Button variant="outline" asChild>
                    <Link href="/olympia/client/matches">Quay lại danh sách trận</Link>
                </Button>
            </div>
        </div>
    )
}
