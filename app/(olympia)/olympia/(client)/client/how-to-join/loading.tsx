import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function HowToJoinLoadingPage() {
    return (
        <section className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2 py-6">
                <Skeleton className="h-10 w-96 mx-auto" />
                <Skeleton className="h-6 w-96 mx-auto" />
            </div>

            {/* Three Cards */}
            <div className="space-y-4">
                <Skeleton className="h-8 w-32" />
                <div className="grid gap-6 lg:grid-cols-3">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} className="p-6 space-y-4">
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-6 w-32" />
                            <div className="space-y-2">
                                {[...Array(5)].map((_, j) => (
                                    <Skeleton key={j} className="h-4 w-full" />
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* FAQ */}
            <Card className="p-6 space-y-4">
                <Skeleton className="h-8 w-40" />
                <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-full" />
                        </div>
                    ))}
                </div>
            </Card>
        </section>
    )
}
