import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader } from '@/components/ui/card'

export default function OlympiaGameLoading() {
    return (
        <div className="space-y-8 bg-slate-900 ">
            {/* Alert skeleton */}
            <div className="rounded-lg p-4 h-20 dark:bg-slate-900" />

            {/* Main content */}
            <div className="grid gap-6 lg:grid-cols-4 dark:bg-slate-900">
                {/* Game area */}
                <div className="lg:col-span-3 space-y-4 dark:bg-slate-900">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-48 w-full bg-slate-200 dark:bg-slate-700" />
                        </CardHeader>
                    </Card>
                </div>

                {/* Sidebar */}
                <aside className="space-y-4 dark:bg-slate-900">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-8 w-32 mb-2 bg-slate-200 dark:bg-slate-700" />
                            <div className="space-y-2">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Skeleton key={i} className="h-4 w-full bg-slate-200 dark:bg-slate-700" />
                                ))}
                            </div>
                        </CardHeader>
                    </Card>
                </aside>
            </div>
        </div>
    )
}
