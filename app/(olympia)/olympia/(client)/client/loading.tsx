import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader } from "@/components/ui/card"

export default function OlympiaClientLoading() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative h-48 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900">
        <div className="absolute inset-0 flex flex-col justify-center items-center p-6">
          <Skeleton className="h-10 w-80 mb-4 bg-slate-200 dark:bg-slate-700" />
          <Skeleton className="h-6 w-48 bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40 mb-3 bg-slate-200 dark:bg-slate-700" />
              <Skeleton className="h-4 w-full mb-2 bg-slate-200 dark:bg-slate-700" />
              <Skeleton className="h-4 w-3/4 mb-4 bg-slate-200 dark:bg-slate-700" />
              <Skeleton className="h-10 w-32 bg-slate-200 dark:bg-slate-700" />
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Leaderboard skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-48 mb-4 bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-5 flex-1 bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-5 w-16 bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}
