import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader } from "@/components/ui/card"

export default function OlympiaClientLoading() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative h-48 bg-gradient-to-br from-purple-500 to-indigo-700 rounded-lg overflow-hidden">
        <div className="absolute inset-0 flex flex-col justify-center items-center p-6">
          <Skeleton className="h-10 w-80 bg-white/20 mb-4" />
          <Skeleton className="h-6 w-48 bg-white/20" />
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-4" />
              <Skeleton className="h-10 w-32" />
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Leaderboard skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-48 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-5 flex-1" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}
