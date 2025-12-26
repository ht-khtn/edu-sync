import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

export default function OlympiaWatchMatchLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <Skeleton className="h-5 w-24 bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-8 w-64 bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-5 w-96 bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Info cards grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} className={i === 0 ? 'border-dashed' : ''}>
                        <CardHeader>
                            <Skeleton className="h-6 w-40 mb-2 bg-slate-200 dark:bg-slate-700" />
                            <Skeleton className="h-4 w-full mb-2 bg-slate-200 dark:bg-slate-700" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-10 w-full bg-slate-200 dark:bg-slate-700" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
