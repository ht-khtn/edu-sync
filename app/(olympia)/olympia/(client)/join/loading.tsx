import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

export default function OlympiaJoinLoading() {
    return (
        <section className="min-h-screen flex items-center justify-center py-8">
            <div className="w-full max-w-md space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <Skeleton className="h-10 w-48 mx-auto bg-slate-200 dark:bg-slate-700" />
                    <Skeleton className="h-5 w-64 mx-auto bg-slate-200 dark:bg-slate-700" />
                </div>

                {/* Form */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-32 mb-2 bg-slate-200 dark:bg-slate-700" />
                        <Skeleton className="h-4 w-48 bg-slate-200 dark:bg-slate-700" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full bg-slate-200 dark:bg-slate-700" />
                        <Skeleton className="h-10 w-full bg-slate-200 dark:bg-slate-700" />
                        <Skeleton className="h-10 w-full bg-slate-200 dark:bg-slate-700" />
                    </CardContent>
                </Card>

                {/* Info Cards */}
                <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <Card key={i} className="border-dashed">
                            <CardContent className="pt-6">
                                <Skeleton className="h-6 w-32 mb-3 bg-slate-200 dark:bg-slate-700" />
                                <Skeleton className="h-20 w-full bg-slate-200 dark:bg-slate-700" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Button */}
                <Skeleton className="h-10 w-full bg-slate-200 dark:bg-slate-700" />
            </div>
        </section>
    )
}
