import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

export default function OlympiaGuestWatchLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-3">
                <div>
                    <Skeleton className="h-5 w-32 mb-2 bg-slate-200 dark:bg-slate-700" />
                    <Skeleton className="h-10 w-80 mb-3 bg-slate-200 dark:bg-slate-700" />
                    <Skeleton className="h-6 w-96 bg-slate-200 dark:bg-slate-700" />
                </div>
            </div>

            {/* Info cards grid */}
            <div className="grid gap-6 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-6 w-40 mb-2 bg-slate-200 dark:bg-slate-700" />
                            <Skeleton className="h-4 w-32 bg-slate-200 dark:bg-slate-700" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-24 w-full bg-slate-200 dark:bg-slate-700" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Scoreboard skeleton */}
            <Card className="border-dashed">
                <CardHeader>
                    <Skeleton className="h-7 w-48 mb-2 bg-slate-200 dark:bg-slate-700" />
                    <Skeleton className="h-4 w-96 bg-slate-200 dark:bg-slate-700" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-48 w-full bg-slate-200 dark:bg-slate-700" />
                </CardContent>
            </Card>

            {/* Buttons */}
            <div className="flex flex-col gap-2 sm:flex-row">
                <Skeleton className="h-10 w-40 bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-10 w-48 bg-slate-200 dark:bg-slate-700" />
            </div>
        </div>
    )
}
