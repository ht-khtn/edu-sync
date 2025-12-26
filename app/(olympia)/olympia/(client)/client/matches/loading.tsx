import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function OlympiaMatchesLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <Skeleton className="h-10 w-64 bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-6 w-96 bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="upcoming" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upcoming" disabled>
                        <Skeleton className="h-5 w-32 bg-slate-200 dark:bg-slate-700" />
                    </TabsTrigger>
                    <TabsTrigger value="past" disabled>
                        <Skeleton className="h-5 w-32 bg-slate-200 dark:bg-slate-700" />
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="upcoming" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i}>
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <Skeleton className="h-6 w-40 mb-2 bg-slate-200 dark:bg-slate-700" />
                                            <Skeleton className="h-4 w-48 bg-slate-200 dark:bg-slate-700" />
                                        </div>
                                        <Skeleton className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-10 w-full bg-slate-200 dark:bg-slate-700" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
