import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function MatchesLoadingPage() {
    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-6 w-96" />
            </div>

            {/* Tabs */}
            <div className="space-y-4">
                <div className="flex gap-4 border-b">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>

                {/* Match Cards Grid */}
                <div className="grid gap-4 lg:grid-cols-2">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i} className="p-6 space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-6 w-48" />
                                    <Skeleton className="h-4 w-64" />
                                </div>
                                <Skeleton className="h-6 w-24" />
                            </div>
                            <Skeleton className="h-10 w-full" />
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    )
}
