'use client'

import { useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type ErrorBoundaryProps = {
    error: Error & { digest?: string }
    reset: () => void
}

export default function OlympiaJoinError({ error, reset }: ErrorBoundaryProps) {
    useEffect(() => {
        console.error('Olympia join route error', error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center py-8">
            <div className="w-full max-w-md space-y-4">
                <Alert variant="destructive">
                    <AlertTitle>Có lỗi xảy ra</AlertTitle>
                    <AlertDescription>
                        Không thể tải trang tham gia phòng thi. Vui lòng thử lại hoặc quay lại.
                    </AlertDescription>
                </Alert>
                <div className="flex flex-col gap-2">
                    <Button variant="outline" onClick={reset}>
                        Thử lại
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/olympia/client">Quay lại trang chủ</Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
