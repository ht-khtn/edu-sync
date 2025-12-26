import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

export default function OlympiaHowToJoinLoading() {
    return (
        <section className="space-y-8">
            {/* Header */}
            <div className="space-y-2">
                <Skeleton className="h-10 w-64 bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-6 w-96 bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Mode Cards */}
            <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <div className="flex items-start gap-4">
                                <Skeleton className="h-8 w-8 rounded flex-shrink-0 bg-slate-200 dark:bg-slate-700" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-7 w-48 bg-slate-200 dark:bg-slate-700" />
                                    <Skeleton className="h-5 w-96 bg-slate-200 dark:bg-slate-700" />
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {/* Features */}
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-20 bg-slate-200 dark:bg-slate-700" />
                                <div className="grid md:grid-cols-2 gap-2">
                                    {Array.from({ length: 4 }).map((_, j) => (
                                        <Skeleton key={j} className="h-5 w-full bg-slate-200 dark:bg-slate-700" />
                                    ))}
                                </div>
                            </div>

                            {/* How to */}
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-700" />
                                {Array.from({ length: 3 }).map((_, j) => (
                                    <Skeleton key={j} className="h-5 w-full bg-slate-200 dark:bg-slate-700" />
                                ))}
                            </div>

                            {/* Button */}
                            <Skeleton className="h-10 w-full bg-slate-200 dark:bg-slate-700" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* FAQ */}
            <Card className="border-dashed">
                <CardHeader>
                    <Skeleton className="h-6 w-32 bg-slate-200 dark:bg-slate-700" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-5 w-48 bg-slate-200 dark:bg-slate-700" />
                            <Skeleton className="h-4 w-full bg-slate-200 dark:bg-slate-700" />
                            <Skeleton className="h-4 w-5/6 bg-slate-200 dark:bg-slate-700" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </section>
    )
}
