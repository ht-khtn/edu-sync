import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function GuestLoadingPage() {
    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-6 w-64" />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Join Code Card */}
                <Card className="flex flex-col items-center justify-center p-6 space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-20 w-48" />
                    <Skeleton className="h-10 w-40" />
                </Card>

                {/* Status Card */}
                <Card className="p-6 space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                </Card>

                {/* Players Card */}
                <Card className="p-6 space-y-4">
                    <Skeleton className="h-6 w-24" />
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-8 w-full" />
                        ))}
                    </div>
                </Card>
            </div>

            {/* Scoreboard Card */}
            <Card className="p-6 space-y-4">
                <Skeleton className="h-8 w-40" />
                <div className="h-64 flex items-center justify-center">
                    <Skeleton className="h-32 w-full" />
                </div>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex gap-3">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-40" />
            </div>
        </section>
    )
}
