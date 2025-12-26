import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function JoinLoadingPage() {
    return (
        <section className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2 py-4">
                <Skeleton className="h-10 w-64 mx-auto" />
                <Skeleton className="h-6 w-80 mx-auto" />
            </div>

            {/* Form Card */}
            <Card className="border-2 border-blue-200 bg-blue-50 p-6 space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-48" />
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </Card>

            {/* Info Alert */}
            <Card className="p-4 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-full" />
            </Card>

            {/* Join Methods Grid */}
            <div className="space-y-4">
                <Skeleton className="h-8 w-32" />
                <div className="grid gap-4 md:grid-cols-3">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} className="p-6 space-y-4">
                            <Skeleton className="h-6 w-20" />
                            <Skeleton className="h-6 w-32" />
                            <div className="space-y-2">
                                {[...Array(4)].map((_, j) => (
                                    <Skeleton key={j} className="h-4 w-full" />
                                ))}
                            </div>
                            <Skeleton className="h-10 w-full" />
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    )
}
