'use client'

import { useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export default function GuestErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error('[Olympia Guest Error]', error)
    }, [error])

    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">⚠️ Có lỗi xảy ra</h1>
                <p className="text-lg text-muted-foreground">Không thể tải trang xem trực tiếp</p>
            </div>

            <Alert variant="destructive" className="border-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Lỗi tải dữ liệu</AlertTitle>
                <AlertDescription className="mt-2 space-y-2">
                    <p>{error.message || 'Có lỗi không xác định. Vui lòng thử lại sau.'}</p>
                    {error.digest && <p className="text-xs font-mono text-muted-foreground">ID: {error.digest}</p>}
                </AlertDescription>
            </Alert>

            <div className="flex gap-3">
                <Button onClick={reset} className="gap-2">
                    Thử lại
                </Button>
                <Button asChild variant="outline" className="gap-2">
                    <Link href="/olympia/client/matches">
                        <ArrowLeft className="h-4 w-4" />
                        Quay lại danh sách trận
                    </Link>
                </Button>
            </div>
        </section>
    )
}
